"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import MapView from "../components/map-view"
import { fetchMuseumObjects, fetchAllMuseumObjects, clearApiCache } from "../lib/api"
import type { MuseumObject, MapBounds } from "../types"
import { useMediaQuery } from "../hooks/use-media-query"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import ResizableObjectContainer, { type ContainerSize } from "../components/resizable-object-container"
import { countUniqueArcs } from "../lib/arc-utils"

export default function Home() {
  const [objects, setObjects] = useState<MuseumObject[]>([])
  const [filteredObjects, setFilteredObjects] = useState<MuseumObject[]>([])
  const [allObjects, setAllObjects] = useState<MuseumObject[]>([])
  const [viewState, setViewState] = useState({
    longitude: 0, // Default to world view
    latitude: 20,
    zoom: 2, // Start zoomed out to show the world
    name: "Site",
  })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [arcCount, setArcCount] = useState(0)
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null)
  const [locationName, setLocationName] = useState<string>(viewState.name || "")
  const [isObjectGridVisible, setIsObjectGridVisible] = useState(true)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const mapRef = useRef<any>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [activeFilters, setActiveFilters] = useState({
    from: [] as string[],
    to: [] as string[],
    institution: [] as string[],
    country: [] as string[],
  })
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [initialArcSelected, setInitialArcSelected] = useState(false)
  const [mapLoadError, setMapLoadError] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [containerSize, setContainerSize] = useState<ContainerSize>("default")
  // Add a new state variable for the search box
  const [showSearchBox, setShowSearchBox] = useState(false)
  // Add a new state variable for object container visibility
  const [isObjectContainerVisible, setIsObjectContainerVisible] = useState(true)

  // Add this handler function
  const handleMapError = useCallback((error: string) => {
    console.error("Map error detected:", error)
    setMapLoadError(true)

    // Show a toast notification
    toast({
      title: "Map Error",
      description: "There was an error loading the map. Some features may be limited.",
      variant: "destructive",
    })
  }, [])

  // Fetch initial filter data (small subset for filtering)
  useEffect(() => {
    const fetchInitialFilterData = async () => {
      try {
        setIsLoading(true)
        const { objects, pagination } = await fetchAllMuseumObjects(200) // Increased to 200 objects for more arcs
        setAllObjects(objects)
        setTotalCount(pagination.total)

        // Calculate and set the arc count
        const uniqueArcs = countUniqueArcs(objects)
        setArcCount(uniqueArcs)

        setInitialLoadComplete(true)
        setIsLoading(false)
      } catch (error) {
        console.error("Failed to fetch initial filter data:", error)
        setIsLoading(false)

        if (error instanceof Error && error.message.includes("rate limit")) {
          setIsRateLimited(true)
          toast({
            title: "Rate limit exceeded",
            description: "The API is currently rate limited. Some features may be unavailable.",
            variant: "destructive",
          })
        }
      }
    }

    fetchInitialFilterData()
  }, [])

  // Apply filters to objects
  useEffect(() => {
    if (objects.length === 0) {
      setFilteredObjects([])
      return
    }

    let filtered = [...objects]

    // Apply "from" filters
    if (activeFilters.from.length > 0) {
      filtered = filtered.filter(
        (obj) => obj.attributes.place_name && activeFilters.from.includes(obj.attributes.place_name),
      )
    }

    // Apply "to" filters
    if (activeFilters.to.length > 0) {
      filtered = filtered.filter(
        (obj) => obj.attributes.institution_place && activeFilters.to.includes(obj.attributes.institution_place),
      )
    }

    // Apply "institution" filters
    if (activeFilters.institution.length > 0) {
      filtered = filtered.filter(
        (obj) => obj.attributes.institution_name && activeFilters.institution.includes(obj.attributes.institution_name),
      )
    }

    // Apply "country" filters
    if (activeFilters.country.length > 0) {
      filtered = filtered.filter(
        (obj) => obj.attributes.country && activeFilters.country.includes(obj.attributes.country),
      )
    }

    setFilteredObjects(filtered)

    // Update arc count based on filtered objects
    const uniqueArcs = countUniqueArcs(filtered)
    setArcCount(uniqueArcs)
  }, [objects, activeFilters])

  useEffect(() => {
    console.log("API Base URL:", process.env.NEXT_PUBLIC_API_BASE_URL)
    console.log("Environment variables:", {
      NEXT_PUBLIC_MAPBOX_STYLE: process.env.NEXT_PUBLIC_MAPBOX_STYLE ? "Set" : "Not set",
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    })

    if (!process.env.NEXT_PUBLIC_MAPBOX_STYLE) {
      setError("Mapbox style is missing. Please set the NEXT_PUBLIC_MAPBOX_STYLE environment variable.")
    }
    if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
      setError("API base URL is missing. Please set the NEXT_PUBLIC_API_BASE_URL environment variable.")
    }
  }, [])

  const fetchObjects = useCallback(
    async (bounds: MapBounds, page: number, reset = false) => {
      if (isRateLimited) {
        toast({
          title: "Rate limit active",
          description: "Cannot fetch new data while rate limited. Please try again later.",
          variant: "destructive",
        })
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        console.log("Fetching objects with bounds:", bounds, "page:", page)
        const { objects, pagination } = await fetchMuseumObjects(bounds, page)

        console.log(`Fetched ${objects.length} objects out of ${pagination.total} total`)

        if (objects && Array.isArray(objects)) {
          setObjects((prevObjects) => {
            const newObjects = reset || page === 1 ? objects : [...prevObjects, ...objects]
            console.log(`Updated objects array: ${newObjects.length} objects`)

            // Calculate arc count for the new objects
            const uniqueArcs = countUniqueArcs(newObjects)
            setArcCount(uniqueArcs)

            return newObjects
          })
          setTotalCount(pagination.total)
          setHasMore(pagination.page < pagination.pageCount)
          setCurrentPage(pagination.page)

          // Reset rate limited state if successful
          if (isRateLimited) {
            setIsRateLimited(false)
          }
        } else {
          throw new Error("Invalid data structure received from API")
        }
      } catch (error) {
        console.error("Failed to fetch objects:", error)

        // Check if it's a rate limit error
        if (error instanceof Error && error.message.includes("rate limit")) {
          setIsRateLimited(true)
          toast({
            title: "Rate limit exceeded",
            description: "The API is currently rate limited. Some features may be unavailable.",
            variant: "destructive",
          })
        } else {
          setError(error instanceof Error ? error.message : "An unknown error occurred")
        }
      } finally {
        setIsLoading(false)
      }
    },
    [isRateLimited],
  )

  // Only updating the handleBoundsChange function to use our proxy
  const handleBoundsChange = useCallback(
    async (bounds: MapBounds) => {
      // Skip if rate limited
      if (isRateLimited) return

      console.log("Bounds changed:", bounds)
      setCurrentBounds(bounds)

      // Always fetch objects when bounds change
      await fetchObjects(bounds, 1, true)

      try {
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

        if (data?.features?.length > 0) {
          setLocationName(data.features[0].text) // City name only
        } else {
          // Don't display coordinates
          setLocationName("Site")
        }
      } catch (error) {
        console.error("Error fetching location name:", error)
        // Set a default name instead of empty
        setLocationName("Site")
      }
    },
    [fetchObjects, isRateLimited],
  )

  const handleLoadMore = useCallback(() => {
    if (currentBounds && hasMore && !isLoading && !isRateLimited) {
      const nextPage = currentPage + 1
      fetchObjects(currentBounds, nextPage)
    }
  }, [currentBounds, hasMore, isLoading, currentPage, fetchObjects, isRateLimited])

  const handleLocationFound = useCallback((longitude: number, latitude: number, name: string) => {
    setViewState({
      longitude,
      latitude,
      zoom: 10,
      name,
    })
    setLocationName(name)
  }, [])

  const handleObjectClick = useCallback((longitude: number, latitude: number) => {
    // Update the view state
    setViewState((prev) => ({
      ...prev,
      longitude,
      latitude,
      zoom: 12,
    }))

    // Use the map reference to fly to the location
    if (mapRef.current?.map) {
      mapRef.current.map.flyTo({
        center: [longitude, latitude],
        zoom: 12,
        essential: true,
        duration: 1500,
      })
    }
  }, [])

  const handleFilterChange = useCallback(
    (fromFilters: string[], toFilters: string[], institutionFilters: string[], countryFilters: string[]) => {
      setActiveFilters({
        from: fromFilters,
        to: toFilters,
        institution: institutionFilters,
        country: countryFilters,
      })
    },
    [],
  )

  // Handle retry after rate limit
  const handleRetry = useCallback(() => {
    // Clear the API cache
    clearApiCache()
    setIsRateLimited(false)

    // Retry fetching data
    if (currentBounds) {
      fetchObjects(currentBounds, 1, true)
    } else {
      // Fetch initial objects if no bounds set
      fetchAllMuseumObjects(50)
        .then(({ objects, pagination }) => {
          setAllObjects(objects)
          setTotalCount(pagination.total)
          setArcCount(countUniqueArcs(objects))
        })
        .catch((error) => {
          console.error("Failed to fetch initial objects on retry:", error)
        })
    }

    toast({
      title: "Retrying",
      description: "Attempting to fetch data again...",
    })
  }, [currentBounds, fetchObjects])

  // Memoize the objects to pass to components
  const displayObjects = useMemo(() => {
    const objectsToDisplay = filteredObjects && filteredObjects.length > 0 ? filteredObjects : objects || []

    // Update arc count based on displayed objects
    if (objectsToDisplay.length !== objects.length || filteredObjects.length > 0) {
      const uniqueArcs = countUniqueArcs(objectsToDisplay)
      setArcCount(uniqueArcs)
    }

    // Debug: Check if objects have valid coordinates for arcs
    if (objectsToDisplay.length > 0) {
      const validForArcs = objectsToDisplay.filter(
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
      console.log(`Objects with valid coordinates for arcs: ${validForArcs.length} out of ${objectsToDisplay.length}`)
    }

    return objectsToDisplay
  }, [filteredObjects, objects])

  // Toggle view mode between grid and list
  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "grid" ? "list" : "grid"))
  }, [])

  // Toggle container size
  const toggleContainerSize = useCallback(() => {
    setContainerSize((prev) => (prev === "default" ? "expanded" : "default"))
  }, [])

  // Add a downloadCSV function to the Home component
  // Add this function after the toggleContainerSize function

  const downloadObjectsAsCSV = useCallback(() => {
    // Create CSV header
    const headers = [
      "ID",
      "Title",
      "Inventory Number",
      "From Place",
      "From City",
      "From Country",
      "To Institution",
      "To Place",
      "To City",
      "To Country",
      "Longitude",
      "Latitude",
      "Institution Longitude",
      "Institution Latitude",
    ].join(",")

    // Convert objects to CSV rows
    const csvRows = displayObjects.map((obj) => {
      const attrs = obj.attributes
      return [
        obj.id,
        `"${(attrs.title || "").replace(/"/g, '""')}"`,
        `"${(attrs.inventory_number || "").replace(/"/g, '""')}"`,
        `"${(attrs.place_name || "").replace(/"/g, '""')}"`,
        `"${(attrs.city_en || "").replace(/"/g, '""')}"`,
        `"${(attrs.country_en || "").replace(/"/g, '""')}"`,
        `"${(attrs.institution_name || "").replace(/"/g, '""')}"`,
        `"${(attrs.institution_place || "").replace(/"/g, '""')}"`,
        `"${(attrs.institution_city_en || "").replace(/"/g, '""')}"`,
        `"${(attrs.institution_country_en || "").replace(/"/g, '""')}"`,
        attrs.longitude || "",
        attrs.latitude || "",
        attrs.institution_longitude || "",
        attrs.institution_latitude || "",
      ].join(",")
    })

    // Combine header and rows
    const csvContent = [headers, ...csvRows].join("\n")

    // Create a blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `ex-situ-objects-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [displayObjects])

  // Add this effect to select a random arc after initial data load
  useEffect(() => {
    // Only run this once when we have objects and haven't selected an arc yet
    if (allObjects && allObjects.length > 0 && !initialArcSelected && initialLoadComplete) {
      console.log("Selecting random arc from", allObjects.length, "objects")

      // Filter objects that have valid coordinates for both source and destination
      const validObjects = allObjects.filter(
        (obj) =>
          obj.attributes?.longitude &&
          obj.attributes?.latitude &&
          obj.attributes?.institution_longitude &&
          obj.attributes?.institution_latitude &&
          // Ensure source and destination are different (there's an actual movement)
          (obj.attributes.longitude !== obj.attributes.institution_longitude ||
            obj.attributes.latitude !== obj.attributes.institution_latitude),
      )

      console.log("Found", validObjects.length, "valid objects with arcs")

      if (validObjects.length > 0) {
        // Select a random object
        const randomIndex = Math.floor(Math.random() * validObjects.length)
        const randomObject = validObjects[randomIndex]

        console.log("Selected random object:", randomObject.id)

        // Fly to the source location (where the artifact is from)
        const newViewState = {
          longitude: randomObject.attributes.longitude,
          latitude: randomObject.attributes.latitude,
          zoom: 8,
          name: randomObject.attributes.place_name || "Selected Location",
        }

        setViewState(newViewState)

        // If we have a map reference, fly to the location
        if (mapRef.current?.map) {
          mapRef.current.map.flyTo({
            center: [newViewState.longitude, newViewState.latitude],
            zoom: newViewState.zoom,
            essential: true,
            duration: 2000,
          })
        }

        // Set location name
        setLocationName(randomObject.attributes.place_name || "Selected Location")

        // Show a toast notification with styling matching the object container
        toast({
          title: "Arc Selected",
          description: `Viewing arc from ${randomObject.attributes.place_name || "Unknown"} to ${randomObject.attributes.institution_name || "Unknown"}`,
          className: "bg-black/80 text-white border border-gray-700 backdrop-blur-sm",
          position: "top-right",
        })
      } else {
        // If no valid objects, just set initialArcSelected to true to prevent further attempts
        setInitialArcSelected(true)

        // Set a default view
        setViewState({
          longitude: 0,
          latitude: 20,
          zoom: 2,
          name: "Site",
        })

        setLocationName("Site")
      }
    }
  }, [allObjects, initialArcSelected, initialLoadComplete, toast])

  // Add this debug function at the top of the component, before the return statement
  useEffect(() => {
    // Debug function to check if objects have valid coordinates for arcs
    const checkValidObjects = () => {
      if (objects.length === 0) return

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

      console.log(`Objects with valid coordinates for arcs: ${validObjects.length} out of ${objects.length}`)

      if (validObjects.length > 0) {
        console.log("Sample object:", {
          id: validObjects[0].id,
          source: [validObjects[0].attributes.longitude, validObjects[0].attributes.latitude],
          target: [validObjects[0].attributes.institution_longitude, validObjects[0].attributes.institution_latitude],
        })
      }
    }

    checkValidObjects()
  }, [objects])

  // Add a toggle function
  const toggleObjectContainerVisibility = useCallback(() => {
    setIsObjectContainerVisible((prev) => !prev)
  }, [])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-red-50 text-red-500">
        <div className="text-center p-8">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p className="text-sm font-normal mb-4">{error}</p>
          <Button onClick={handleRetry} variant="outline" className="mx-auto">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="h-screen w-full relative">
        {/* Full screen map */}
        <MapView
          ref={mapRef}
          initialViewState={{
            ...viewState,
            name: locationName,
          }}
          onBoundsChange={handleBoundsChange}
          objects={displayObjects}
          allObjects={allObjects}
          onError={handleMapError}
          totalCount={totalCount}
          onToggleView={toggleViewMode}
          onExpandView={toggleContainerSize}
          viewMode={viewMode}
          containerSize={containerSize}
          locationName={locationName}
          setShowSearchBox={setShowSearchBox}
          onDownloadCSV={downloadObjectsAsCSV}
          isObjectContainerVisible={isObjectContainerVisible}
          toggleObjectContainerVisibility={toggleObjectContainerVisibility}
        />

        {mapLoadError && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <p className="text-sm">Map failed to load. You can still browse objects in the panel.</p>
            </div>
            <Button className="mt-2 w-full" size="sm" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        )}

        {/* Object grid floating panel */}
        {isObjectGridVisible && isObjectContainerVisible && (
          <ResizableObjectContainer
            objects={displayObjects}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            totalCount={totalCount}
            arcCount={arcCount}
            isLoading={isLoading}
            onObjectClick={handleObjectClick}
            onLocationFound={handleLocationFound}
            locationName={locationName}
            onClose={() => setIsObjectGridVisible(false)}
            isMobile={isMobile}
            viewMode={viewMode}
            setViewMode={setViewMode}
            containerSize={containerSize}
            setContainerSize={setContainerSize}
          />
        )}

        {/* Rate limit warning */}
        {isRateLimited && (
          <div className="absolute top-16 right-4 z-50 bg-red-500 text-white p-3 rounded-md shadow-lg">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <span className="text-sm">API rate limited</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full bg-white/20 hover:bg-white/30 text-white"
              onClick={handleRetry}
            >
              Retry
            </Button>
          </div>
        )}
      </div>
      <Toaster />
    </main>
  )
}
