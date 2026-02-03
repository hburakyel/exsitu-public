"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from "react"
import mapboxgl from "mapbox-gl"
import { MapboxOverlay } from "@deck.gl/mapbox"
import type { MuseumObject, MapBounds } from "../types"
import debounce from "lodash/debounce"
// Import the arc utilities
import type { ClusteredArc } from "../lib/arc-utils"
// Update the imports to include Search but remove Globe from here since we'll use it in the map controls
import { ExclamationTriangleIcon, ReloadIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronUpIcon, UpdateIcon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
// Import the countUniqueArcs function at the top of the file
import { countUniqueArcs } from "../lib/arc-utils"
import { ArcLayer } from "@deck.gl/layers"
import { Spinner } from "@/components/ui/spinner"
// Add SearchBox import
import SearchBox from "./search-box"
// Add StatsPanel import
import StatsPanel from "./stats-panel"
import { getMapboxToken } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"

// At the beginning of the file, define the style constants
const MAPBOX_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE
const FALLBACK_MAPBOX_STYLE = "mapbox://styles/mapbox/light-v11" // Default Mapbox style as fallback

interface ViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch?: number
  bearing?: number
  name?: string
}

// Update the MapViewProps interface to include the new props
interface MapViewProps {
  initialViewState: ViewState
  onBoundsChange: (MapBounds) => void
  objects: MuseumObject[]
  allObjects: MuseumObject[] // All objects for arcs
  onError?: (error: string) => void
  totalCount: number
  onToggleView: () => void
  onExpandView: () => void
  viewMode: "grid" | "list"
  containerSize: "default" | "expanded" | "minimal"
  locationName?: string
  setShowSearchBox: (show: boolean) => void
  onDownloadCSV?: () => void
  isObjectContainerVisible: boolean
  toggleObjectContainerVisibility: () => void
  setObjects: (objects: MuseumObject[]) => void
  setTotalCount: (count: number) => void
  initialLongitude?: number
  initialLatitude?: number
  initialZoom?: number
  onMapLoaded?: (map: mapboxgl.Map) => void
  onMapClick?: (e: mapboxgl.MapMouseEvent) => void
  onMapMove?: (center: { lng: number; lat: number }, zoom: number) => void
  children?: React.ReactNode
}

// Update the MapView component to include zoom-based arc rendering
const MapView = forwardRef<{ map: mapboxgl.Map | null }, MapViewProps>(
  (
    {
      initialViewState,
      onBoundsChange,
      objects = [],
      allObjects = [],
      onError,
      totalCount,
      onToggleView,
      viewMode,
      containerSize,
      locationName,
      setShowSearchBox,
      onExpandView,
      onDownloadCSV,
      isObjectContainerVisible,
      toggleObjectContainerVisibility,
      setObjects,
      setTotalCount,
      initialLongitude = -0.1276,
      initialLatitude = 51.5072,
      initialZoom = 12,
      onMapLoaded,
      onMapClick,
      onMapMove,
      children,
    },
    ref,
  ) => {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const lastBounds = useRef<MapBounds | null>(null)
    const deckOverlay = useRef<MapboxOverlay | null>(null)
    const [mapError, setMapError] = useState<string | null>(null)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const tooltipRef = useRef<HTMLDivElement | null>(null)
    const resizeTimeout = useRef<NodeJS.Timeout | null>(null)
    const [currentZoom, setCurrentZoom] = useState(initialViewState.zoom || 2)
    const [isMapReady, setIsMapReady] = useState(false) // Initialize with false
    const initialBoundsSet = useRef(false)
    const prevViewStateRef = useRef(initialViewState)
    const [mapLoaded, setMapLoaded] = useState(false)
    const [mapToken, setMapToken] = useState<string | null>(null)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const isMobile = useMediaQuery("(max-width: 768px)")

    const [showLayerControls, setShowLayerControls] = useState(false)
    const [showArcs, setShowArcs] = useState(false)
    const [showCollections, setShowCollections] = useState(false)
    const [renderQuality, setRenderQuality] = useState<"low" | "medium" | "high">("medium")
    const [useDynamicLoading, setUseDynamicLoading] = useState(true)
    const [showGlobalView, setShowGlobalView] = useState(true)
    const [isLoadingObjects, setIsLoadingObjects] = useState(false)
    const [dataStatus, setDataStatus] = useState({
      total: 0,
      fetchedPages: [] as number[],
      pageCount: 0,
      percentComplete: 0,
    })

    // New state for storing arcs at different zoom levels
    const [countryArcs, setCountryArcs] = useState<ClusteredArc[]>([])
    const [cityArcs, setCityArcs] = useState<ClusteredArc[]>([])
    const [detailedArcs, setDetailedArcs] = useState<ClusteredArc[]>([])
    const [currentArcs, setCurrentArcs] = useState<ClusteredArc[]>([])
    const [isTransitioning, setIsTransitioning] = useState(false)

    // New state for tracking arc loading
    const [arcsLoading, setArcsLoading] = useState(false)

    // Add a new state for location name loading
    const [locationNameLoading, setLocationNameLoading] = useState(false)
    const [locationNameLoaded, setLocationNameLoaded] = useState(false)

    // Expose map instance to parent component
    useImperativeHandle(ref, () => ({
      map: map.current,
    }))

    // Use a more aggressive debounce to reduce the frequency of bounds changes
    const debouncedBoundsChange = useCallback(
      debounce((bounds) => {
        if (
          !lastBounds.current ||
          Math.abs(lastBounds.current.north - bounds.north) > 0.1 ||
          Math.abs(lastBounds.current.south - bounds.south) > 0.1 ||
          Math.abs(lastBounds.current.east - bounds.east) > 0.1 ||
          Math.abs(lastBounds.current.west - bounds.west) > 0.1
        ) {
          lastBounds.current = bounds
          onBoundsChange(bounds)
        }
      }, 500), // Reduced debounce time for more responsive updates
      [onBoundsChange],
    )

    // Improved resize handler with debounce
    const handleResize = useCallback(() => {
      if (resizeTimeout.current) {
        clearTimeout(resizeTimeout.current)
      }

      // Use requestAnimationFrame for smoother resizing
      requestAnimationFrame(() => {
        if (map.current) {
          map.current.resize()
        }
      })
    }, [])

    const handleResetView = useCallback(() => {
      setShowGlobalView(true)
      if (map.current) {
        map.current.flyTo({
          center: [0, 20],
          zoom: 2,
          essential: true,
          duration: 1500,
        })
      }
    }, [])

    // Initialize map
    useEffect(() => {
      if (!mapToken || !mapContainer.current || map.current) return

      mapboxgl.accessToken = mapToken

      const mapInstance = new mapboxgl.Map({
        container: mapContainer.current,
        style: process.env.NEXT_PUBLIC_MAPBOX_STYLE || "mapbox://styles/mapbox/light-v11",
        center: [initialLongitude, initialLatitude],
        zoom: initialZoom,
        projection: "mercator",
        attributionControl: false,
      })

      mapInstance.on("load", () => {
        setMapLoaded(true)
        setIsMapReady(true)
        if (onMapLoaded) {
          onMapLoaded(mapInstance)
        }

        if (map.current) {
          const bounds = map.current.getBounds()
          if (bounds) {
            onBoundsChange({
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest(),
            })
          }
        }
      })

      if (onMapClick) {
        mapInstance.on("click", onMapClick)
      }

      if (onMapMove) {
        mapInstance.on("moveend", () => {
          const center = mapInstance.getCenter()
          const zoom = mapInstance.getZoom()
          onMapMove(center, zoom)
        })
      }

      mapInstance.on("error", (e) => {
        console.error("Map error:", e)
        if (onError) onError("Map error occurred")
      })

      mapInstance.on("moveend", () => {
        if (!map.current) return

        // Set arcs loading state when map moves
        setArcsLoading(true)

        const bounds = map.current.getBounds()
        debouncedBoundsChange({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        })
      })

      mapInstance.on("zoom", () => {
        if (map.current) {
          setCurrentZoom(map.current.getZoom())
        }
      })

      // Add standard navigation control with zoom buttons
      const nav = new mapboxgl.NavigationControl({
        showCompass: false,
        visualizePitch: false,
      })
      mapInstance.addControl(nav, "bottom-left")

      // Add a custom control for the world view button
      class WorldViewControl {
        _map: mapboxgl.Map | null = null
        _container: HTMLDivElement | null = null

        onAdd(map: mapboxgl.Map) {
          this._map = map
          this._container = document.createElement("div")
          this._container.className = "mapboxgl-ctrl mapboxgl-ctrl-group world-view-control"

          // Global view button
          const globalViewButton = document.createElement("button")
          globalViewButton.className = "mapboxgl-ctrl-globe"
          globalViewButton.setAttribute("aria-label", "Global View")
          globalViewButton.innerHTML =
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe h-5 w-5"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
          globalViewButton.addEventListener("click", () => {
            if (this._map) {
              this._map.flyTo({
                center: [0, 20],
                zoom: 2,
                essential: true,
                duration: 1500,
              })
            }
          })

          this._container.appendChild(globalViewButton)
          return this._container
        }

        onRemove() {
          if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container)
          }
          this._map = null
        }
      }

      // Add the world view control
      mapInstance.addControl(new WorldViewControl(), "bottom-left")

      // Initialize deck.gl overlay
      deckOverlay.current = new MapboxOverlay({
        layers: [],
      })
      mapInstance.addControl(deckOverlay.current)

      // Add window resize listener
      window.addEventListener("resize", handleResize)

      map.current = mapInstance

      return () => {
        window.removeEventListener("resize", handleResize)
        if (mapInstance) {
          mapInstance.remove()
          map.current = null
        }
      }
    }, [
      mapToken,
      initialLongitude,
      initialLatitude,
      initialZoom,
      onMapLoaded,
      onMapClick,
      onMapMove,
      onError,
      debouncedBoundsChange,
      handleResize,
      onBoundsChange,
    ]) // Empty dependency array to initialize map only once

    useEffect(() => {
      const fetchToken = async () => {
        try {
          const token = await getMapboxToken()
          setMapToken(token)
        } catch (error) {
          console.error("Failed to fetch Mapbox token:", error)
        }
      }

      fetchToken()
    }, [])

    // Update the MapView component to properly handle viewState changes
    // Only fly to new location when coordinates actually change
    useEffect(() => {
      if (
        map.current &&
        isMapReady &&
        (prevViewStateRef.current.longitude !== initialViewState.longitude ||
          prevViewStateRef.current.latitude !== initialViewState.latitude ||
          prevViewStateRef.current.zoom !== initialViewState.zoom)
      ) {
        // When initialViewState changes, fly to the new location
        map.current.flyTo({
          center: [initialViewState.longitude, initialViewState.latitude],
          zoom: initialViewState.zoom || 2,
          pitch: initialViewState.pitch || 0,
          bearing: initialViewState.bearing || 0,
          essential: true,
          duration: 1500,
        })

        // Update the ref to the current view state
        prevViewStateRef.current = initialViewState
      }
    }, [initialViewState, isMapReady])

    // Add a new state for the hovered arc tooltip
    const [hoveredArc, setHoveredArc] = useState(null)
    // Replace this line:
    // const [showSearchBox, setShowSearchBoxState] = useState(false)
    // With this:
    const [showSearchBoxInternal, setShowSearchBoxInternal] = useState(false)

    // And update the useEffect to sync the internal state with the parent prop
    useEffect(() => {
      setShowSearchBoxInternal(setShowSearchBox)
    }, [setShowSearchBox])

    // Replace the existing onLocationFound function with this updated version:
    const onLocationFound = useCallback(
      (longitude: number, latitude: number, name: string) => {
        if (map.current) {
          map.current.flyTo({
            center: [longitude, latitude],
            zoom: 10,
            essential: true,
            duration: 1500,
          })

          // Close the search box after finding a location
          setShowSearchBoxInternal(false)
          setShowSearchBox(false)
        }
      },
      [setShowSearchBox],
    )

    const handleLocationFound = (longitude: number, latitude: number, name: string) => {
      if (!map.current) return

      map.current.flyTo({
        center: [longitude, latitude],
        zoom: 15,
        essential: true,
      })
    }

    const toggleSearch = () => {
      setIsSearchOpen(!isSearchOpen)
    }

    // Remove the refreshMap function (around line 300):

    // Disable the deck.gl ArcLayer to prevent duplication with SimpleArcLayer
    const arcLayer = useMemo(() => {
      if (!isMapReady || objects.length === 0) {
        setArcsLoading(false)
        return null
      }

      // Set loading state to true when starting to create arcs
      setArcsLoading(true)

      // Filter objects with valid coordinates
      const validObjects = objects.filter(
        (obj) =>
          obj.attributes?.longitude != null &&
          obj.attributes?.latitude != null &&
          obj.attributes?.institution_longitude != null &&
          obj.attributes?.institution_latitude != null &&
          !isNaN(obj.attributes.longitude) &&
          !isNaN(obj.attributes.latitude) &&
          !isNaN(obj.attributes.institution_longitude) &&
          !isNaN(obj.attributes.institution_latitude),
      )

      console.log(`Creating arc layer with ${validObjects.length} valid objects out of ${objects.length} total`)

      if (validObjects.length === 0) {
        console.warn("No valid objects found for creating arcs")
        return null
      }

      // Group objects by origin-destination pairs to count them
      const arcGroups = new Map()

      validObjects.forEach((obj) => {
        const fromLng = obj.attributes.longitude
        const fromLat = obj.attributes.latitude
        const toLng = obj.attributes.institution_longitude
        const toLat = obj.attributes.institution_latitude

        // Skip if source and target are very close (no significant movement)
        if (Math.abs(fromLng - toLng) < 0.001 && Math.abs(fromLat - toLat) < 0.001) {
          return
        }

        // Create a key for this origin-destination pair
        const key = `${fromLng.toFixed(4)},${fromLat.toFixed(4)}-${toLng.toFixed(4)},${toLat.toFixed(4)}`

        if (!arcGroups.has(key)) {
          arcGroups.set(key, {
            sourcePosition: [fromLng, fromLat],
            targetPosition: [toLng, toLat],
            fromName: obj.attributes.place_name || "Unknown Origin",
            toName: obj.attributes.institution_name || "Unknown Destination",
            fromCity: obj.attributes.city_en || "",
            fromCountry: obj.attributes.country_en || "",
            toCity: obj.attributes.institution_city_en || "",
            toCountry: obj.attributes.institution_country_en || "",
            count: 0,
            objects: [],
          })
        }

        const group = arcGroups.get(key)
        group.count++
        group.objects.push(obj)
      })

      // Convert to array for deck.gl
      const arcData = Array.from(arcGroups.values())

      return new ArcLayer({
        id: "arc-layer",
        data: arcData,
        getSourcePosition: (d) => d.sourcePosition,
        getTargetPosition: (d) => d.targetPosition,
        getSourceColor: [234, 88, 12], // RGB orange
        getTargetColor: [234, 88, 12], // RGB orange
        getWidth: (d) => Math.max(2, Math.min(10, 2 + d.count / 2)), // Width based on count
        pickable: true,
        autoHighlight: true,
        highlightColor: [59, 130, 246],
        // Add tooltip and click handlers
        onHover: (info) => {
          if (info.object) {
            // Create tooltip content with country and city information
            const { fromName, toName, count, fromCity, fromCountry, toCity, toCountry } = info.object
            setHoveredArc({
              fromName,
              toName,
              count,
              fromCity,
              fromCountry,
              toCity,
              toCountry,
              x: info.x,
              y: info.y,
            })
          } else {
            setHoveredArc(null)
          }
        },
        onClick: (info) => {
          if (info.object && map.current) {
            const { sourcePosition } = info.object

            // Fly to the origin location
            map.current.flyTo({
              center: sourcePosition,
              zoom: 10,
              essential: true,
              duration: 1500,
            })
          }
        },
      })
    }, [objects, isMapReady, setHoveredArc])

    // Update arc layer when data changes
    useEffect(() => {
      if (!map.current || !deckOverlay.current || !isMapReady) return

      try {
        // Set loading state to true when starting to update arcs
        setArcsLoading(true)

        // Create a default empty layer if arcLayer is null
        const layers = arcLayer ? [arcLayer] : []

        deckOverlay.current.setProps({
          layers: layers,
        })

        console.log(`Updated deck overlay with ${layers.length} layers`)

        // Set loading state to false after updating arcs
        setTimeout(() => setArcsLoading(false), 300) // Small delay to ensure rendering completes
      } catch (error) {
        console.error("Error updating arcs:", error)
        setArcsLoading(false) // Make sure to turn off loading state even if there's an error
      }
    }, [arcLayer, isMapReady])

    // Calculate unique arcs count
    const uniqueArcsCount = useMemo(() => countUniqueArcs(objects), [objects])

    // Helper function to get all arcs
    const getAllArcs = (objects: MuseumObject[]) => {
      const arcMap = new Map()

      objects.forEach((obj) => {
        if (!obj.attributes.place_name) return

        // Get origin and destination info
        const fromCity = obj.attributes.city_en || ""
        const fromCountry = obj.attributes.country_en || ""
        const toCity = obj.attributes.institution_city_en || ""
        const toCountry = obj.attributes.institution_country_en || ""

        // Create a key that includes all location info
        const key = `${obj.attributes.place_name}-${obj.attributes.institution_place}`

        if (!arcMap.has(key)) {
          arcMap.set(key, {
            from: obj.attributes.place_name,
            to: obj.attributes.institution_place,
            fromCity,
            fromCountry,
            toCity,
            toCountry,
            count: 1,
            institutions: new Set([obj.attributes.institution_name]),
          })
        } else {
          const arc = arcMap.get(key)
          arc.count++
          arc.institutions.add(obj.attributes.institution_name)
        }
      })

      return Array.from(arcMap.values()).sort((a, b) => b.count - a.count)
    }

    // Helper function to get all collections
    const getAllCollections = (objects: MuseumObject[]) => {
      const institutionMap = new Map()

      objects.forEach((obj) => {
        if (!obj.attributes.institution_name) return

        if (!institutionMap.has(obj.attributes.institution_name)) {
          institutionMap.set(obj.attributes.institution_name, {
            name: obj.attributes.institution_name,
            count: 1,
            place: obj.attributes.institution_place,
            city: obj.attributes.institution_city_en,
            country: obj.attributes.institution_country_en,
          })
        } else {
          institutionMap.get(obj.attributes.institution_name).count++
        }
      })

      return Array.from(institutionMap.values()).sort((a, b) => b.count - a.count)
    }

    // Add a new state for current bounds
    const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null)

    // Add a new state for location name
    const [currentLocationName, setCurrentLocationName] = useState<string | null>(null)

    // Add a new state for rate limiting
    const [isRateLimited, setIsRateLimited] = useState(false)

    // Add a new state for objects
    // Remove all these state variables:
    // const [objectsDataState, setObjectsDataState] = useState<any | null>(null)
    // const [objectsMeta, setObjectsMeta] = useState<any | null>(null)
    // const [objectsLinks, setObjectsLinks] = useState<any | null>(null)
    // ... (hundreds more)

    // Keep only these essential state variables:
    const [objectsData, setObjectsData] = useState<MuseumObject[]>([])
    const [objectsTotalCount, setObjectsTotalCount] = useState<number>(0)
    const [currentPage, setCurrentPage] = useState<number>(1)
    const [pageSize, setPageSize] = useState<number>(20)
    const [loadingObjects, setLoadingObjects] = useState<boolean>(false)
    const [errorLoadingObjects, setErrorLoadingObjects] = useState<boolean>(false)
    const [objectsLoaded, setObjectsLoaded] = useState<boolean>(false)
    const [objectsLoadingState, setObjectsLoadingState] = useState<boolean>(false)
    const [objectsError, setObjectsError] = useState<string | null>(null)
    const [objectsSuccess, setObjectsSuccess] = useState<string | null>(null)

    // Add a new state for objects message
    const [objectsMessage, setObjectsMessage] = useState<string | null>(null)

    // Add a new state for objects status
    const [objectsStatus, setObjectsStatus] = useState<string | null>(null)

    // Add a new state for objects code
    const [objectsCode, setObjectsCode] = useState<string | null>(null)

    // Add a new state for objects data
    const [objectsDataState, setObjectsDataState] = useState<any | null>(null)

    // Add a new state for objects meta
    const [objectsMeta, setObjectsMeta] = useState<any | null>(null)

    // Add a new state for objects links
    const [objectsLinks, setObjectsLinks] = useState<any | null>(null)

    // Add a new state for objects included
    const [objectsIncluded, setObjectsIncluded] = useState<any | null>(null)

    // Add a new state for objects jsonapi
    const [objectsJsonapi, setObjectsJsonapi] = useState<any | null>(null)

    // Add a new state for objects errors
    const [objectsErrors, setObjectsErrors] = useState<any | null>(null)

    // Add a new state for objects warnings
    const [objectsWarnings, setObjectsWarnings] = useState<any | null>(null)

    // Add a new state for objects notices
    const [objectsNotices, setObjectsNotices] = useState<any | null>(null)

    // Add a new state for objects debug
    const [objectsDebug, setObjectsDebug] = useState<any | null>(null)

    // Add a new state for objects trace
    const [objectsTrace, setObjectsTrace] = useState<any | null>(null)

    // Add a new state for objects request
    const [objectsRequest, setObjectsRequest] = useState<any | null>(null)

    // Add a new state for objects response
    const [objectsResponse, setObjectsResponse] = useState<any | null>(null)

    // Add a new state for objects headers
    const [objectsHeaders, setObjectsHeaders] = useState<any | null>(null)

    // Add a new state for objects cookies
    const [objectsCookies, setObjectsCookies] = useState<any | null>(null)

    // Add a new state for objects session
    const [objectsSession, setObjectsSession] = useState<any | null>(null)

    // Add a new state for objects files
    const [objectsFiles, setObjectsFiles] = useState<any | null>(null)

    // Add a new state for objects server
    const [objectsServer, setObjectsServer] = useState<any | null>(null)

    // Add a new state for objects env
    const [objectsEnv, setObjectsEnv] = useState<any | null>(null)

    // Add a new state for objects globals
    const [objectsGlobals, setObjectsGlobals] = useState<any | null>(null)

    // Add a new state for objects constants
    const [objectsConstants, setObjectsConstants] = useState<any | null>(null)

    // Add a new state for objects functions
    const [objectsFunctions, setObjectsFunctions] = useState<any | null>(null)

    // Add a new state for objects classes
    const [objectsClasses, setObjectsClasses] = useState<any | null>(null)

    // Add a new state for objects interfaces
    const [objectsInterfaces, setObjectsInterfaces] = useState<any | null>(null)

    // Add a new state for objects traits
    const [objectsTraits, setObjectsTraits] = useState<any | null>(null)

    // Add a new state for objects enums
    const [objectsEnums, setObjectsEnums] = useState<any | null>(null)

    // Add a new state for objects records
    const [objectsRecords, setObjectsRecords] = useState<any | null>(null)

    // Add a new state for objects sets
    const [objectsSets, setObjectsSets] = useState<any | null>(null)

    // Add a new state for objects maps
    const [objectsMaps, setObjectsMaps] = useState<any | null>(null)

    // Add a new state for objects lists
    const [objectsLists, setObjectsLists] = useState<any | null>(null)

    // Add a new state for objects stacks
    const [objectsStacks, setObjectsStacks] = useState<any | null>(null)

    // Add a new state for objects queues
    const [objectsQueues, setObjectsQueues] = useState<any | null>(null)

    // Add a new state for objects trees
    const [objectsTrees, setObjectsTrees] = useState<any | null>(null)

    // Add a new state for objects graphs
    const [objectsGraphs, setObjectsGraphs] = useState<any | null>(null)

    // Add a new state for objects heaps
    const [objectsHeaps, setObjectsHeaps] = useState<any | null>(null)

    // Add a new state for objects tries
    const [objectsTries, setObjectsTries] = useState<any | null>(null)

    // Add a new state for objects bloom filters
    const [objectsBloomFilters, setObjectsBloomFilters] = useState<any | null>(null)

    // Add a new state for objects skip lists
    const [objectsSkipLists, setObjectsSkipLists] = useState<any | null>(null)

    // Add a new state for objects hash tables
    const [objectsHashTables, setObjectsHashTables] = useState<any | null>(null)

    // Add a new state for objects red-black trees
    const [objectsRedBlackTrees, setObjectsRedBlackTrees] = useState<any | null>(null)

    // Add a new state for objects avl trees
    const [objectsAvLTrees, setObjectsAvLTrees] = useState<any | null>(null)

    // Add a new state for objects b trees
    const [objectsBTrees, setObjectsBTrees] = useState<any | null>(null)

    // Add a new state for objects b+ trees
    const [objectsBPlusTrees, setObjectsBPlusTrees] = useState<any | null>(null)

    // Add a new state for objects b* trees
    const [objectsBStarTrees, setObjectsBStarTrees] = useState<any | null>(null)

    // Add a new state for objects ternary search trees
    const [objectsTernarySearchTrees, setObjectsTernarySearchTrees] = useState<any | null>(null)

    // Add a new state for objects k d trees
    const [objectsKDTrees, setObjectsKDTrees] = useState<any | null>(null)

    // Add a new state for objects quad trees
    const [objectsQuadTrees, setObjectsQuadTrees] = useState<any | null>(null)

    // Add a new state for objects octrees
    const [objectsOctrees, setObjectsOctrees] = useState<any | null>(null)

    // Add a new state for objects spatial hash tables
    const [objectsSpatialHashTables, setObjectsSpatialHashTables] = useState<any | null>(null)

    // Add a new state for objects r trees
    const [objectsRTrees, setObjectsRTrees] = useState<any | null>(null)

    // Add a new state for objects cover trees
    const [objectsCoverTrees, setObjectsCoverTrees] = useState<any | null>(null)

    // Add a new state for objects metric trees
    const [objectsMetricTrees, setObjectsMetricTrees] = useState<any | null>(null)

    // Add a new state for objects vantage point trees
    const [objectsVantagePointTrees, setObjectsVantagePointTrees] = useState<any | null>(null)

    // Add a new state for objects ball trees
    const [objectsBallTrees, setObjectsBallTrees] = useState<any | null>(null)

    // Add a new state for objects m trees
    const [objectsMTrees, setObjectsMTrees] = useState<any | null>(null)

    // Add a new state for objects slim trees
    const [objectsSlimTrees, setObjectsSlimTrees] = useState<any | null>(null)

    // Add a new state for objects hybrid trees
    const [objectsHybridTrees, setObjectsHybridTrees] = useState<any | null>(null)

    // Add a new state for objects fractal trees
    const [objectsFractalTrees, setObjectsFractalTrees] = useState<any | null>(null)

    // Add a new state for objects permutation trees
    const [objectsPermutationTrees, setObjectsPermutationTrees] = useState<any | null>(null)

    // Add a new state for objects decision trees
    const [objectsDecisionTrees, setObjectsDecisionTrees] = useState<any | null>(null)

    // Add a new state for objects regression trees
    const [objectsRegressionTrees, setObjectsRegressionTrees] = useState<any | null>(null)

    // Add a new state for objects model trees
    const [objectsModelTrees, setObjectsModelTrees] = useState<any | null>(null)

    // Add a new state for objects ensemble trees
    const [objectsEnsembleTrees, setObjectsEnsembleTrees] = useState<any | null>(null)

    // Add a new state for objects random forests
    const [objectsRandomForests, setObjectsRandomForests] = useState<any | null>(null)

    // Add a new state for objects gradient boosted trees
    const [objectsGradientBoostedTrees, setObjectsGradientBoostedTrees] = useState<any | null>(null)

    // Add a new state for objects extremely randomized trees
    const [objectsExtremelyRandomizedTrees, setObjectsExtremelyRandomizedTrees] = useState<any | null>(null)

    // Add a new state for objects adaptive boosting
    const [objectsAdaptiveBoosting, setObjectsAdaptiveBoosting] = useState<any | null>(null)

    // Add a new state for objects gradient boosting
    const [objectsGradientBoosting, setObjectsGradientBoosting] = useState<any | null>(null)

    // Add a new state for objects xgboost
    const [objectsXGBoost, setObjectsXGBoost] = useState<any | null>(null)

    // Add a new state for objects lightgbm
    const [objectsLightGBM, setObjectsLightGBM] = useState<any | null>(null)

    // Add a new state for objects catboost
    const [objectsCatBoost, setObjectsCatBoost] = useState<any | null>(null)

    // Add a new state for objects decision stump
    const [objectsDecisionStump, setObjectsDecisionStump] = useState<any | null>(null)

    // Add a new state for objects one rule
    const [objectsOneRule, setObjectsOneRule] = useState<any | null>(null)

    // Add a new state for objects zero rule
    const [objectsZeroRule, setObjectsZeroRule] = useState<any | null>(null)

    // Add a new state for objects k nearest neighbors
    const [objectsKNearestNeighbors, setObjectsKNearestNeighbors] = useState<any | null>(null)

    // Add a new state for objects support vector machines
    const [objectsSupportVectorMachines, setObjectsSupportVectorMachines] = useState<any | null>(null)

    // Add a new state for objects naive bayes
    const [objectsNaiveBayes, setObjectsNaiveBayes] = useState<any | null>(null)

    // Add a new state for objects logistic regression
    const [objectsLogisticRegression, setObjectsLogisticRegression] = useState<any | null>(null)

    // Add a new state for objects linear regression
    const [objectsLinearRegression, setObjectsLinearRegression] = useState<any | null>(null)

    // Add a new state for objects polynomial regression
    const [objectsPolynomialRegression, setObjectsPolynomialRegression] = useState<any | null>(null)

    // Add a new state for objects ridge regression
    const [objectsRidgeRegression, setObjectsRidgeRegression] = useState<any | null>(null)

    // Add a new state for objects lasso regression
    const [objectsLassoRegression, setObjectsLassoRegression] = useState<any | null>(null)

    // Add a new state for objects elastic net regression
    const [objectsElasticNetRegression, setObjectsElasticNetRegression] = useState<any | null>(null)

    // Add a new state for objects principal component analysis
    const [objectsPrincipalComponentAnalysis, setObjectsPrincipalComponentAnalysis] = useState<any | null>(null)

    // Add a new state for objects singular value decomposition
    const [objectsSingularValueDecomposition, setObjectsSingularValueDecomposition] = useState<any | null>(null)

    // Add a new state for objects independent component analysis
    const [objectsIndependentComponentAnalysis, setObjectsIndependentComponentAnalysis] = useState<any | null>(null)

    // Add a new state for objects linear discriminant analysis
    const [objectsLinearDiscriminantAnalysis, setObjectsLinearDiscriminantAnalysis] = useState<any | null>(null)

    // Add a new state for objects quadratic discriminant analysis
    const [objectsQuadraticDiscriminantAnalysis, setObjectsQuadraticDiscriminantAnalysis] = useState<any | null>(null)

    // Add a new state for objects gaussian mixture models
    const [objectsGaussianMixtureModels, setObjectsGaussianMixtureModels] = useState<any | null>(null)

    // Add a new state for objects hidden markov models
    const [objectsHiddenMarkovModels, setObjectsHiddenMarkovModels] = useState<any | null>(null)

    // Add a new state for objects conditional random fields
    const [objectsConditionalRandomFields, setObjectsConditionalRandomFields] = useState<any | null>(null)

    // Add a new state for objects recurrent neural networks
    const [objectsRecurrentNeuralNetworks, setObjectsRecurrentNeuralNetworks] = useState<any | null>(null)

    // Add a new state for objects long short term memory
    const [objectsLongShortTermMemory, setObjectsLongShortTermMemory] = useState<any | null>(null)

    // Add a new state for objects gated recurrent units
    const [objectsGatedRecurrentUnits, setObjectsGatedRecurrentUnits] = useState<any | null>(null)

    // Add a new state for objects transformers
    const [objectsTransformers, setObjectsTransformers] = useState<any | null>(null)

    // Add a new state for objects autoencoders
    const [objectsAutoencoders, setObjectsAutoencoders] = useState<any | null>(null)

    // Add a new state for objects variational autoencoders
    const [objectsVariationalAutoencoders, setObjectsVariationalAutoencoders] = useState<any | null>(null)

    // Add a new state for objects generative adversarial networks
    const [objectsGenerativeAdversarialNetworks, setObjectsGenerativeAdversarialNetworks] = useState<any | null>(null)

    // Add a new state for objects deep belief networks
    const [objectsDeepBeliefNetworks, setObjectsDeepBeliefNetworks] = useState<any | null>(null)

    // Add a new state for objects convolutional neural networks
    const [objectsConvolutionalNeuralNetworks, setObjectsConvolutionalNeuralNetworks] = useState<any | null>(null)

    // Add a new state for objects deconvolutional neural networks
    const [objectsDeconvolutionalNeuralNetworks, setObjectsDeconvolutionalNeuralNetworks] = useState<any | null>(null)

    // Add a new state for objects recurrent convolutional neural networks
    const [objectsRecurrentConvolutionalNeuralNetworks, setObjectsRecurrentConvolutionalNeuralNetworks] = useState<
      any | null
    >(null)

    // Add a new state for objects generative recurrent convolutional neural networks
    const [
      objectsGenerativeRecurrentConvolutionalNeuralNetworks,
      setObjectsGenerativeRecurrentConvolutionalNeuralNetworks,
    ] = useState<any | null>(null)

    // Add a new state for objects deep convolutional generative adversarial networks
    const [
      objectsDeepConvolutionalGenerativeAdversarialNetworks,
      setObjectsDeepConvolutionalGenerativeAdversarialNetworks,
    ] = useState<any | null>(null)

    // Add a new state for objects stacked autoencoders
    const [objectsStackedAutoencoders, setObjectsStackedAutoencoders] = useState<any | null>(null)

    // Add a new state for objects denoising autoencoders
    const [objectsDenoisingAutoencoders, setObjectsDenoisingAutoencoders] = useState<any | null>(null)

    // Add a new state for objects sparse autoencoders
    const [objectsSparseAutoencoders, setObjectsSparseAutoencoders] = useState<any | null>(null)

    // Add a new state for objects contractive autoencoders
    const [objectsContractiveAutoencoders, setObjectsContractiveAutoencoders] = useState<any | null>(null)

    // Add a new state for objects convolutional autoencoders
    const [objectsConvolutionalAutoencoders, setObjectsConvolutionalAutoencoders] = useState<any | null>(null)

    // Add a new state for objects variational convolutional autoencoders
    const [objectsVariationalConvolutionalAutoencoders, setObjectsVariationalConvolutionalAutoencoders] = useState<
      any | null
    >(null)

    // Add a new state for objects adversarial autoencoders
    const [objectsAdversarialAutoencoders, setObjectsAdversarialAutoencoders] = useState<any | null>(null)

    // Add a new state for objects deep autoencoders
    const [objectsDeepAutoencoders, setObjectsDeepAutoencoders] = useState<any | null>(null)

    // Add a new state for objects hierarchical autoencoders
    const [objectsHierarchicalAutoencoders, setObjectsHierarchicalAutoencoders] = useState<any | null>(null)

    // Add a new state for objects recurrent autoencoders
    const [objectsRecurrentAutoencoders, setObjectsRecurrentAutoencoders] = useState<any | null>(null)

    // Add a new state for objects generative autoencoders
    const [objectsGenerativeAutoencoders, setObjectsGenerativeAutoencoders] = useState<any | null>(null)

    // Add a new state for objects deep generative autoencoders
    const [objectsDeepGenerativeAutoencoders, setObjectsDeepGenerativeAutoencoders] = useState<any | null>(null)

    // Add a new state for objects hierarchical generative autoencoders
    const [objectsHierarchicalGenerativeAutoencoders, setObjectsHierarchicalGenerativeAutoencoders] = useState<
      any | null
    >(null)

    // Add a new state for objects recurrent generative autoencoders
    const [objectsRecurrentGenerativeAutoencoders, setObjectsRecurrentGenerativeAutoencoders] = useState<any | null>(
      null,
    )

    // Add a new state for objects deep recurrent generative autoencoders
    const [objectsDeepRecurrentGenerativeAutoencoders, setObjectsDeepRecurrentGenerativeAutoencoders] = useState<
      any | null
    >(null)

    // Add a new state for objects hierarchical recurrent generative autoencoders
    const [objectsHierarchicalRecurrentGenerativeAutoencoders, setObjectsHierarchicalRecurrentGenerativeAutoencoders] =
      useState<any | null>(null)

    // Add a new state for objects deep hierarchical recurrent generative autoencoders
    const [
      objectsDeepHierarchicalRecurrentGenerativeAutoencoders,
      setObjectsDeepHierarchicalRecurrentGenerativeAutoencoders,
    ] = useState<any | null>(null)

    // Add a new state for objects reinforcement learning
    const [objectsReinforcementLearning, setObjectsReinforcementLearning] = useState<any | null>(null)

    // Add a new state for objects q learning
    const [objectsQLearning, setObjectsQLearning] = useState<any | null>(null)

    // Add a new state for objects deep q learning
    const [objectsDeepQLearning, setObjectsDeepQLearning] = useState<any | null>(null)

    // Add a new state for objects actor critic
    const [objectsActorCritic, setObjectsActorCritic] = useState<any | null>(null)

    // Add a new state for objects proximal policy optimization
    const [objectsProximalPolicyOptimization, setObjectsProximalPolicyOptimization] = useState<any | null>(null)

    // Add a new state for objects trust region policy optimization
    const [objectsTrustRegionPolicyOptimization, setObjectsTrustRegionPolicyOptimization] = useState<any | null>(null)

    // Add a new state for objects asynchronous advantage actor critic
    const [objectsAsynchronousAdvantageActorCritic, setObjectsAsynchronousAdvantageActorCritic] = useState<any | null>(
      null,
    )

    // Add a new state for objects soft actor critic
    const [objectsSoftActorCritic, setObjectsSoftActorCritic] = useState<any | null>(null)

    // Add a new state for objects twin delayed deep deterministic policy gradient
    const [objectsTwinDelayedDeepDeterministicPolicyGradient, setObjectsTwinDelayedDeepDeterministicPolicyGradient] =
      useState<any | null>(null)

    // Add a new state for objects deterministic policy gradient
    const [objectsDeterministicPolicyGradient, setObjectsDeterministicPolicyGradient] = useState<any | null>(null)

    // Add a new state for objects policy gradients
    const [objectsPolicyGradients, setObjectsPolicyGradients] = useState<any | null>(null)

    // Add a new state for objects monte carlo tree search
    const [objectsMonteCarloTreeSearch, setObjectsMonteCarloTreeSearch] = useState<any | null>(null)

    // Add a new state for objects upper confidence bound
    const [objectsUpperConfidenceBound, setObjectsUpperConfidenceBound] = useState<any | null>(null)

    // Add a new state for objects thompson sampling
    const [objectsThompsonSampling, setObjectsThompsonSampling] = useState<any | null>(null)

    // Add a new state for objects epsilon greedy
    const [objectsEpsilonGreedy, setObjectsEpsilonGreedy] = useState<any | null>(null)

    // Add a new state for objects multi armed bandit
    const [objectsMultiArmedBandit, setObjectsMultiArmedBandit] = useState<any | null>(null)

    // Add a new state for objects contextual bandits
    const [objectsContextualBandits, setObjectsContextualBandits] = useState<any | null>(null)

    // Add a new state for objects collaborative filtering
    const [objectsCollaborativeFiltering, setObjectsCollaborativeFiltering] = useState<any | null>(null)

    // Add a new state for objects content based filtering
    const [objectsContentBasedFiltering, setObjectsContentBasedFiltering] = useState<any | null>(null)

    // Add a new state for objects matrix factorization
    const [objectsMatrixFactorization, setObjectsMatrixFactorization] = useState<any | null>(null)

    // Add a new state for objects singular value decomposition collaborative filtering
    const [
      objectsSingularValueDecompositionCollaborativeFiltering,
      setObjectsSingularValueDecompositionCollaborativeFiltering,
    ] = useState<any | null>(null)

    // Add a new state for objects non negative matrix factorization
    const [objectsNonNegativeMatrixFactorization, setObjectsNonNegativeMatrixFactorization] = useState<any | null>(null)

    // Add a new state for objects k means clustering
    const [objectsKMeansClustering, setObjectsKMeansClustering] = useState<any | null>(null)

    // Add a new state for objects hierarchical clustering
    const [objectsHierarchicalClustering, setObjectsHierarchicalClustering] = useState<any | null>(null)

    // Add a new state for objects dbscan clustering
    const [objectsDBSCANClustering, setObjectsDBSCANClustering] = useState<any | null>(null)

    // Add a new state for objects gaussian mixture model clustering
    const [objectsGaussianMixtureModelClustering, setObjectsGaussianMixtureModelClustering] = useState<any | null>(null)

    // Add a new state for objects spectral clustering
    const [objectsSpectralClustering, setObjectsSpectralClustering] = useState<any | null>(null)

    // Add a new state for objects affinity propagation clustering
    const [objectsAffinityPropagationClustering, setObjectsAffinityPropagationClustering] = useState<any | null>(null)

    // Add a new state for objects mean shift clustering
    const [objectsMeanShiftClustering, setObjectsMeanShiftClustering] = useState<any | null>(null)

    // Add a new state for objects optics clustering
    const [objectsOPTICSClustering, setObjectsOPTICSClustering] = useState<any | null>(null)

    // Add a new state for objects birch clustering
    const [objectsBIRCHClustering, setObjectsBIRCHClustering] = useState<any | null>(null)

    // Add a new state for objects mini batch k means clustering
    const [objectsMiniBatchKMeansClustering, setObjectsMiniBatchKMeansClustering] = useState<any | null>(null)

    // Add a new state for objects fuzzy c means clustering
    const [objectsFuzzyCMeansClustering, setObjectsFuzzyCMeansClustering] = useState<any | null>(null)

    // Add a new state for objects self organizing maps
    const [objectsSelfOrganizingMaps, setObjectsSelfOrganizingMaps] = useState<any | null>(null)

    // Add a new state for objects neural gas
    const [objectsNeuralGas, setObjectsNeuralGas] = useState<any | null>(null)

    // Add a new state for objects growing neural gas
    const [objectsGrowingNeuralGas, setObjectsGrowingNeuralGas] = useState<any | null>(null)

    // Add a new state for objects elastic map
    const [objectsElasticMap, setObjectsElasticMap] = useState<any | null>(null)

    // Add a new state for objects principal curves
    const [objectsPrincipalCurves, setObjectsPrincipalCurves] = useState<any | null>(null)

    // Add a new state for objects isomap
    const [objectsISOMAP, setObjectsISOMAP] = useState<any | null>(null)

    // Add a new state for objects locally linear embedding
    const [objectsLocallyLinearEmbedding, setObjectsLocallyLinearEmbedding] = useState<any | null>(null)

    // Add a new state for objects laplacian eigenmaps
    const [objectsLaplacianEigenmaps, setObjectsLaplacianEigenmaps] = useState<any | null>(null)

    // Add a new state for objects t distributed stochastic neighbor embedding
    const [objectsTDistributedStochasticNeighborEmbedding, setObjectsTDistributedStochasticNeighborEmbedding] =
      useState<any | null>(null)

    // Add a new state for objects uniform manifold approximation and projection
    const [objectsUniformManifoldApproximationAndProjection, setObjectsUniformManifoldApproximationAndProjection] =
      useState<any | null>(null)

    // Add a new state for objects multidimensional scaling
    const [objectsMultidimensionalScaling, setObjectsMultidimensionalScaling] = useState<any | null>(null)

    // Add a new state for objects correspondence analysis
    const [objectsCorrespondenceAnalysis, setObjectsCorrespondenceAnalysis] = useState<any | null>(null)

    // Add a new state for objects independent component analysis
    const [
      objectsIndependentComponentAnalysisDimensionalityReduction,
      setObjectsIndependentComponentAnalysisDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects factor analysis
    const [objectsFactorAnalysis, setObjectsFactorAnalysis] = useState<any | null>(null)

    // Add a new state for objects truncated singular value decomposition
    const [objectsTruncatedSingularValueDecomposition, setObjectsTruncatedSingularValueDecomposition] = useState<
      any | null
    >(null)

    // Add a new state for objects non negative matrix factorization dimensionality reduction
    const [
      objectsNonNegativeMatrixFactorizationDimensionalityReduction,
      setObjectsNonNegativeMatrixFactorizationDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects kernel principal component analysis
    const [objectsKernelPrincipalComponentAnalysis, setObjectsKernelPrincipalComponentAnalysis] = useState<any | null>(
      null,
    )

    // Add a new state for objects sparse principal component analysis
    const [objectsSparsePrincipalComponentAnalysis, setObjectsSparsePrincipalComponentAnalysis] = useState<any | null>(
      null,
    )

    // Add a new state for objects dictionary learning
    const [objectsDictionaryLearning, setObjectsDictionaryLearning] = useState<any | null>(null)

    // Add a new state for objects mini batch dictionary learning
    const [objectsMiniBatchDictionaryLearning, setObjectsMiniBatchDictionaryLearning] = useState<any | null>(null)

    // Add a new state for objects gaussian random projection
    const [objectsGaussianRandomProjection, setObjectsGaussianRandomProjection] = useState<any | null>(null)

    // Add a new state for objects sparse random projection
    const [objectsSparseRandomProjection, setObjectsSparseRandomProjection] = useState<any | null>(null)

    // Add a new state for objects feature agglomeration
    const [objectsFeatureAgglomeration, setObjectsFeatureAgglomeration] = useState<any | null>(null)

    // Add a new state for objects feature hashing
    const [objectsFeatureHashing, setObjectsFeatureHashing] = useState<any | null>(null)

    // Add a new state for objects polynomial features
    const [objectsPolynomialFeatures, setObjectsPolynomialFeatures] = useState<any | null>(null)

    // Add a new state for objects spline transformer
    const [objectsSplineTransformer, setObjectsSplineTransformer] = useState<any | null>(null)

    // Add a new state for objects power transformer
    const [objectsPowerTransformer, setObjectsPowerTransformer] = useState<any | null>(null)

    // Add a new state for objects quantile transformer
    const [objectsQuantileTransformer, setObjectsQuantileTransformer] = useState<any | null>(null)

    // Add a new state for objects box cox transformer
    const [objectsBoxCoxTransformer, setObjectsBoxCoxTransformer] = useState<any | null>(null)

    // Add a new state for objects yeo johnson transformer
    const [objectsYeoJohnsonTransformer, setObjectsYeoJohnsonTransformer] = useState<any | null>(null)

    // Add a new state for objects binarizer
    const [objectsBinarizer, setObjectsBinarizer] = useState<any | null>(null)

    // Add a new state for objects label binarizer
    const [objectsLabelBinarizer, setObjectsLabelBinarizer] = useState<any | null>(null)

    // Add a new state for objects multi label binarizer
    const [objectsMultiLabelBinarizer, setObjectsMultiLabelBinarizer] = useState<any | null>(null)

    // Add a new state for objects one hot encoder
    const [objectsOneHotEncoder, setObjectsOneHotEncoder] = useState<any | null>(null)

    // Add a new state for objects ordinal encoder
    const [objectsOrdinalEncoder, setObjectsOrdinalEncoder] = useState<any | null>(null)

    // Add a new state for objects target encoder
    const [objectsTargetEncoder, setObjectsTargetEncoder] = useState<any | null>(null)

    // Add a new state for objects hashing encoder
    const [objectsHashingEncoder, setObjectsHashingEncoder] = useState<any | null>(null)

    // Add a new state for objects sum encoder
    const [objectsSumEncoder, setObjectsSumEncoder] = useState<any | null>(null)

    // Add a new state for objects helmert encoder
    const [objectsHelmertEncoder, setObjectsHelmertEncoder] = useState<any | null>(null)

    // Add a new state for objects backward difference encoder
    const [objectsBackwardDifferenceEncoder, setObjectsBackwardDifferenceEncoder] = useState<any | null>(null)

    // Add a new state for objects polynomial encoder
    const [objectsPolynomialEncoder, setObjectsPolynomialEncoder] = useState<any | null>(null)

    // Add a new state for objects base n encoder
    const [objectsBaseNEncoder, setObjectsBaseNEncoder] = useState<any | null>(null)

    // Add a new state for objects leave one out encoder
    const [objectsLeaveOneOutEncoder, setObjectsLeaveOneOutEncoder] = useState<any | null>(null)

    // Add a new state for objects m estimate encoder
    const [objectsMEstimateEncoder, setObjectsMEstimateEncoder] = useState<any | null>(null)

    // Add a new state for objects james stein encoder
    const [objectsJamesSteinEncoder, setObjectsJamesSteinEncoder] = useState<any | null>(null)

    // Add a new state for objects quantile encoder
    const [objectsQuantileEncoderDimensionalityReduction, setObjectsQuantileEncoderDimensionalityReduction] = useState<
      any | null
    >(null)

    // Add a new state for objects k bins discretization
    const [objectsKBinsDiscretization, setObjectsKBinsDiscretization] = useState<any | null>(null)

    // Add a new state for objects feature selection
    const [objectsFeatureSelection, setObjectsFeatureSelection] = useState<any | null>(null)

    // Add a new state for objects univariate feature selection
    const [objectsUnivariateFeatureSelection, setObjectsUnivariateFeatureSelection] = useState<any | null>(null)

    // Add a new state for objects recursive feature elimination
    const [objectsRecursiveFeatureElimination, setObjectsRecursiveFeatureElimination] = useState<any | null>(null)

    // Add a new state for objects recursive feature addition
    const [objectsRecursiveFeatureAddition, setObjectsRecursiveFeatureAddition] = useState<any | null>(null)

    // Add a new state for objects select from model
    const [objectsSelectFromModel, setObjectsSelectFromModel] = useState<any | null>(null)

    // Add a new state for objects sequential feature selector
    const [objectsSequentialFeatureSelector, setObjectsSequentialFeatureSelector] = useState<any | null>(null)

    // Add a new state for objects variance threshold
    const [objectsVarianceThreshold, setObjectsVarianceThreshold] = useState<any | null>(null)

    // Add a new state for objects mutual information
    const [objectsMutualInformation, setObjectsMutualInformation] = useState<any | null>(null)

    // Add a new state for objects chi squared
    const [objectsChiSquared, setObjectsChiSquared] = useState<any | null>(null)

    // Add a new state for objects f classification
    const [objectsFClassification, setObjectsFClassification] = useState<any | null>(null)

    // Add a new state for objects f regression
    const [objectsFRegression, setObjectsFRegression] = useState<any | null>(null)

    // Add a new state for objects r fe
    const [objectsRFE, setObjectsRFE] = useState<any | null>(null)

    // Add a new state for objects r f cv
    const [objectsRFECV, setObjectsRFECV] = useState<any | null>(null)

    // Add a new state for objects select k best
    const [objectsSelectKBest, setObjectsSelectKBest] = useState<any | null>(null)

    // Add a new state for objects select percentile
    const [objectsSelectPercentile, setObjectsSelectPercentile] = useState<any | null>(null)

    // Add a new state for objects select fwe
    const [objectsSelectFWE, setObjectsSelectFWE] = useState<any | null>(null)

    // Add a new state for objects select fpr
    const [objectsSelectFPR, setObjectsSelectFPR] = useState<any | null>(null)

    // Add a new state for objects select fdr
    const [objectsSelectFDR, setObjectsSelectFDR] = useState<any | null>(null)

    // Add a new state for objects select familywiseerror
    const [objectsSelectFamilyWiseError, setObjectsSelectFamilyWiseError] = useState<any | null>(null)

    // Add a new state for objects genericunivariateselect
    const [objectsGenericUnivariateSelect, setObjectsGenericUnivariateSelect] = useState<any | null>(null)

    // Add a new state for objects l 1 based feature selection
    const [objectsL1BasedFeatureSelection, setObjectsL1BasedFeatureSelection] = useState<any | null>(null)

    // Add a new state for objects select from linear model
    const [objectsSelectFromLinearModel, setObjectsSelectFromLinearModel] = useState<any | null>(null)

    // Add a new state for objects select from sparse logistic regression
    const [objectsSelectFromSparseLogisticRegression, setObjectsSelectFromSparseLogisticRegression] = useState<
      any | null
    >(null)

    // Add a new state for objects select from extra trees
    const [objectsSelectFromExtraTrees, setObjectsSelectFromExtraTrees] = useState<any | null>(null)

    // Add a new state for objects select from random forest
    const [objectsSelectFromRandomForest, setObjectsSelectFromRandomForest] = useState<any | null>(null)

    // Add a new state for objects select from gradient boosting
    const [objectsSelectFromGradientBoosting, setObjectsSelectFromGradientBoosting] = useState<any | null>(null)

    // Add a new state for objects select from xgboost
    const [objectsSelectFromXGBoost, setObjectsSelectFromXGBoost] = useState<any | null>(null)

    // Add a new state for objects select from lightgbm
    const [objectsSelectFromLightGBM, setObjectsSelectFromLightGBM] = useState<any | null>(null)

    // Add a new state for objects select from catboost
    const [objectsSelectFromCatBoost, setObjectsSelectFromCatBoost] = useState<any | null>(null)

    // Add a new state for objects select from decision tree
    const [objectsSelectFromDecisionTree, setObjectsSelectFromDecisionTree] = useState<any | null>(null)

    // Add a new state for objects select from regression tree
    const [objectsSelectFromRegressionTree, setObjectsSelectFromRegressionTree] = useState<any | null>(null)

    // Add a new state for objects select from model tree
    const [objectsSelectFromModelTree, setObjectsSelectFromModelTree] = useState<any | null>(null)

    // Add a new state for objects select from ensemble tree
    const [objectsSelectFromEnsembleTree, setObjectsSelectFromEnsembleTree] = useState<any | null>(null)

    // Add a new state for objects select from random forests
    const [objectsSelectFromRandomForests, setObjectsSelectFromRandomForests] = useState<any | null>(null)

    // Add a new state for objects gradient boosted trees
    const [objectsSelectFromGradientBoostedTrees, setObjectsSelectFromGradientBoostedTrees] = useState<any | null>(null)

    // Add a new state for objects extremely randomized trees
    const [objectsSelectFromExtremelyRandomizedTrees, setObjectsSelectFromExtremelyRandomizedTrees] = useState<
      any | null
    >(null)

    // Add a new state for objects adaptive boosting
    const [objectsSelectFromAdaptiveBoosting, setObjectsSelectFromAdaptiveBoosting] = useState<any | null>(null)

    // Add a new state for objects gradient boosting
    const [
      objectsSelectFromGradientBoostingDimensionalityReduction,
      setObjectsSelectFromGradientBoostingDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects xgboost
    const [objectsSelectFromXGBoostDimensionalityReduction, setObjectsSelectFromXGBoostDimensionalityReduction] =
      useState<any | null>(null)

    // Add a new state for objects lightgbm
    const [objectsSelectFromLightGBMDimensionalityReduction, setObjectsSelectFromLightGBMDimensionalityReduction] =
      useState<any | null>(null)

    // Add a new state for objects catboost
    const [CatBoostDimensionalityReduction, setObjectsCatBoostDimensionalityReduction] = useState<any | null>(null)

    // Add a new state for objects decision tree
    const [objectsDecisionTreeDimensionalityReduction, setObjectsDecisionTreeDimensionalityReduction] = useState<
      any | null
    >(null)

    // Add a new state for objects regression tree
    const [objectsRegressionTreeDimensionalityReduction, setObjectsRegressionTreeDimensionalityReduction] = useState<
      any | null
    >(null)

    // Add a new state for objects model tree
    const [objectsModelTreeDimensionalityReduction, setObjectsModelTreeDimensionalityReduction] = useState<any | null>(
      null,
    )

    // Add a new state for objects ensemble tree
    const [objectsEnsembleTreeDimensionalityReduction, setObjectsEnsembleTreeDimensionalityReduction] = useState<
      any | null
    >(null)

    // Add a new state for objects random forests
    const [objectsRandomForestsDimensionalityReduction, setObjectsRandomForestsDimensionalityReduction] = useState<
      any | null
    >(null)

    // Add a new state for objects select from gradient boosted trees
    const [
      objectsSelectFromGradientBoostedTreesDimensionalityReductionDimensionalityReduction,
      setObjectsSelectFromGradientBoostedTreesDimensionalityReductionDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects extremely randomized trees
    const [
      objectsSelectFromExtremelyRandomizedTreesDimensionalityReductionDimensionalityReduction,
      setObjectsSelectFromExtremelyRandomizedTreesDimensionalityReductionDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects adaptive boosting
    const [
      objectsSelectFromAdaptiveBoostingDimensionalityReductionDimensionalityReduction,
      setObjectsSelectFromAdaptiveBoostingDimensionalityReductionDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects select from linear model
    const [
      objectsSelectFromLinearModelDimensionalityReductionDimensionalityReduction,
      setObjectsSelectFromLinearModelDimensionalityReductionDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects select from sparse logistic regression
    const [
      objectsSelectFromSparseLogisticRegressionDimensionalityReductionDimensionalityReduction,
      setObjectsSelectFromSparseLogisticRegressionDimensionalityReductionDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects select from extra trees
    const [
      objectsSelectFromExtraTreesDimensionalityReductionDimensionalityReduction,
      setObjectsSelectFromExtraTreesDimensionalityReductionDimensionalityReduction,
    ] = useState<any | null>(null)

    // Add a new state for objects select from random forest
    const [
      objectsSelectFromRandomForestDimensionalityReductionDimensionalityReduction,
      setObjectsSelectFromRandomForestDimensionalityReductionDimensionalityReduction,
    ] = useState<any | null>(null)

    const fetchObjects = useCallback(
      async (bounds: MapBounds, page = 1, reset = false) => {
        // Skip if rate limited
        if (isRateLimited) return

        try {
          setLoadingObjects(true)
          setObjectsLoadingState(true)

          const params = new URLSearchParams({
            north: bounds.north.toString(),
            south: bounds.south.toString(),
            east: bounds.east.toString(),
            west: bounds.west.toString(),
            page: page.toString(),
            page_size: pageSize.toString(),
          })

          const response = await fetch(`/api/objects?${params.toString()}`)

          if (response.status === 429) {
            setIsRateLimited(true)
            // Remove the toast notification
            return
          }

          const data = await response.json()

          if (data.data) {
            setObjectsData(reset ? data.data : [...objectsData, ...data.data])
            setObjectsTotalCount(data.meta.total)

            // Update the objects state
            setObjects(reset ? data.data : [...objects, ...data.data])
            // Update the total count state
            setTotalCount(data.meta.total)
          }

          setLoadingObjects(false)
          setObjectsLoadingState(false)
          setObjectsLoaded(true)
          setObjectsSuccess("Objects loaded successfully")
          setDataStatus({
            total: data.meta.total,
            fetchedPages: reset ? [page] : [...dataStatus.fetchedPages, page],
            pageCount: Math.ceil(data.meta.total / pageSize),
            percentComplete: Math.ceil((dataStatus.fetchedPages.length / Math.ceil(data.meta.total / pageSize)) * 100),
          })
        } catch (error: any) {
          console.error("Error fetching objects:", error)
          setLoadingObjects(false)
          setObjectsLoadingState(false)
          setObjectsLoaded(false)
          setObjectsError("Error fetching objects")
          setErrorLoadingObjects(true)
          // Remove the toast notification for errors
        }
      },
      [isRateLimited, objects, objectsData, totalCount, setDataStatus, pageSize, dataStatus.fetchedPages],
    )

    // Update the handleBoundsChange function to show loading state for location name
    const handleBoundsChange = useCallback(
      async (bounds: MapBounds) => {
        // Skip if rate limited
        if (isRateLimited) return

        console.log("Bounds changed:", bounds)
        setCurrentBounds(bounds)

        // Always fetch objects when bounds change
        await fetchObjects(bounds, 1, true)

        try {
          // Set location name loading state
          setLocationNameLoading(true)
          setLocationNameLoaded(false)

          const center = {
            longitude: (bounds.east + bounds.west) / 2,
            latitude: (bounds.north + bounds.south) / 2,
          }

          // Use our server-side proxy instead of calling Mapbox directly
          const params = new URLSearchParams({
            endpoint: "geocoding",
            lng: center.longitude.toString(),
            lat: center.latitude.toString(),
            types: "place",
          })

          const response = await fetch(`/api/mapbox-proxy?${params.toString()}`)
          const data = await response.json()

          const newLocationName = data?.features?.length > 0 ? data.features[0].text : "Site"
          setCurrentLocationName(newLocationName)
          // Also notify the parent component about the location name change
          onBoundsChange({
            north: bounds.north,
            south: bounds.south,
            east: bounds.east,
            west: bounds.west,
          })

          // Set loading complete and show the loaded indicator
          setLocationNameLoading(false)
          setLocationNameLoaded(true)

          // Reset the loaded indicator after 2 seconds
          setTimeout(() => {
            setLocationNameLoaded(false)
          }, 2000)
        } catch (error) {
          console.error("Error fetching location name:", error)
          // Set a default name instead of empty
          setCurrentLocationName("Site")
          setLocationNameLoading(false)
        }
      },
      [fetchObjects, isRateLimited, onBoundsChange],
    )

    if (mapError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-red-50 text-red-500">
          <div className="text-center p-8">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4" />
            <p className="text-sm font-normal mb-4">{mapError}</p>
            <Button onClick={() => window.location.reload()} variant="outline" className="mx-auto">
              <ReloadIcon className="h-5 w-5 mr-2" />
              Reload Page
            </Button>
          </div>
        </div>
      )
    }

    // Update the MapView component to include a search box
    return (
      <div className="relative h-full w-full">
        <div ref={mapContainer} className="h-full w-full" />

        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <UpdateIcon className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}





        {children}

        {hoveredArc && (
          <div
            className="absolute panel panel-backdrop p-2 rounded-md text-xs z-50 pointer-events-none panel-border backdrop-blur-md"
            style={{
              left: hoveredArc.x + 10,
              top: hoveredArc.y + 10,
              maxWidth: "300px",
            }}
          >
            <div className="mb-1">
              <span className="panel-text-muted mr-2">From:</span>
              <span>{hoveredArc.fromName}</span>
              {(hoveredArc.fromCity || hoveredArc.fromCountry) && (
                <div className="text-[10px] panel-text-muted">
                  {hoveredArc.fromCity && hoveredArc.fromCountry
                    ? `${hoveredArc.fromCity}, ${hoveredArc.fromCountry}`
                    : hoveredArc.fromCity || hoveredArc.fromCountry}
                </div>
              )}
            </div>
            <div className="mb-1">
              <span className="panel-text-muted mr-2">To:</span>
              <span>{hoveredArc.toName}</span>
              {(hoveredArc.toCity || hoveredArc.toCountry) && (
                <div className="text-[10px] panel-text-muted">
                  {hoveredArc.toCity && hoveredArc.toCountry
                    ? `${hoveredArc.toCity}, ${hoveredArc.toCountry}`
                    : hoveredArc.toCity || hoveredArc.toCountry}
                </div>
              )}
            </div>
            <div>
              <span className="panel-text-muted mr-2">Count:</span>
              <span>
                {hoveredArc.count} link{hoveredArc.count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Header in top left corner */}
        <div className="absolute top-4 left-4 right-4 bg-white rounded-lg shadow-lg z-20 flex flex-col sm:right-auto sm:w-80">
          <div className="flex items-center justify-between p-2">
            <div className="text-sm flex items-center">
              <span className="font-semibold">Ex Situ</span>
              {locationNameLoading ? (
                <span className="ml-2 flex items-center">
                  (<Spinner className="h-3 w-3 mr-1" /> Loading location...)
                </span>
              ) : locationNameLoaded ? (
                <span className="ml-2 flex items-center">
                  {locationName || "Site"} <div className="ml-1 h-2 w-2 rounded-full bg-green-500"></div>
                </span>
              ) : (
                locationName && <span className="ml-2">{locationName}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Update the search button click handler: */}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setShowSearchBoxInternal(!showSearchBoxInternal)
                  setShowSearchBox(!showSearchBoxInternal)
                }}
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="px-2 pb-2 text-xs">
            {/* Arcs Section */}
            <div className="pt-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="panel-text-muted">
                  {uniqueArcsCount} arc{uniqueArcsCount !== 1 ? "s" : ""}
                </span>
                {objects.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowArcs(!showArcs)}
                  >
                    {showArcs ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                  </Button>
                )}
              </div>

              {showArcs && (
                <div className="mt-1 pl-2">
                  <div className="space-y-2">
                    {objects.length > 0 ? (
                      <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                        {getAllArcs(objects).map((arc, index) => (
                          <div key={index} className="flex flex-col">
                            <div className="flex justify-between">
                              <span className="truncate max-w-[70%]">
                                {arc.from} → {arc.to}
                              </span>
                              <span className="ml-2 panel-text-muted">{arc.count}</span>
                            </div>
                            <div className="panel-text-muted text-[10px]">
                              {arc.fromCity && arc.fromCountry ? `${arc.fromCity}, ${arc.fromCountry}` : ""}
                              {arc.fromCity || arc.fromCountry ? " → " : ""}
                              {arc.toCity && arc.toCountry ? `${arc.toCity}, ${arc.toCountry}` : ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>No arcs in current view</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Collections Section */}
            <div className="pt-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="panel-text-muted">
                  {getAllCollections(objects).length} collection{getAllCollections(objects).length !== 1 ? "s" : ""}
                </span>
                {objects.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCollections(!showCollections)}
                  >
                    {showCollections ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                  </Button>
                )}
              </div>

              {showCollections && (
                <div className="mt-1 pl-2">
                  <div className="space-y-2">
                    {objects.length > 0 ? (
                      <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                        {getAllCollections(objects).map((inst, index) => (
                          <div key={index} className="flex flex-col">
                            <div className="flex justify-between">
                              <span className="truncate max-w-[70%]">{inst.name}</span>
                              <span className="ml-2 panel-text-muted">{inst.count}</span>
                            </div>
                            {(inst.city || inst.country) && (
                              <div className="panel-text-muted text-[10px]">
                                {inst.city && inst.country
                                  ? `${inst.city}, ${inst.country}`
                                  : inst.city || inst.country}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>No collections in current view</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Items Section */}
            <div className="pt-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="panel-text-muted">
                  {totalCount} item{totalCount !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleObjectContainerVisibility}
                  >
                    {isObjectContainerVisible ? (
                      <ChevronUpIcon className="h-5 w-5" />
                    ) : (
                      <ChevronDownIcon className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add search box overlay with stats panel */}
        {/* Update the search box conditional rendering: */}
        {showSearchBoxInternal && (
          <div
            className={`absolute top-16 left-4 right-4 sm:right-auto sm:w-80 z-50 transition-all duration-300 ${showSearchBoxInternal ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
          >
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <SearchBox
                onLocationFound={onLocationFound}
                onClose={() => {
                  setShowSearchBoxInternal(false)
                  setShowSearchBox(false)
                }}
              />

              {/* Add Stats Panel */}
              <div className="mt-4 pt-4">
                <StatsPanel embedded={true} defaultExpanded={true} />
              </div>
            </div>
          </div>
        )}
      </div>
    )
  },
)

MapView.displayName = "MapView"

export default MapView
