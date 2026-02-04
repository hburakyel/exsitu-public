"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import type { MuseumObject } from "../types"

interface ArcInfoPanelProps {
  objects: MuseumObject[]
  viewMode: "grid" | "list"
  onToggleViewMode: () => void
  className?: string
  onArcClick?: (lat: number, lng: number, zoom?: number) => void
}

export default function ArcInfoPanel({
  objects,
  viewMode,
  onToggleViewMode,
  className = "",
  onArcClick,
}: ArcInfoPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(true) // Initially collapsed
  const [isSticky, setIsSticky] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const initialOffsetTop = useRef<number | null>(null)

  // Extract unique origin-destination pairs with city and country info
  const getUniqueArcs = () => {
    const arcMap = new Map()

    objects.forEach((obj) => {
      if (!obj.attributes.place_name) return

      // Get origin and destination info
      const fromCity = obj.attributes.city_en || ""
      const fromCountry = obj.attributes.country_en || ""
      const toCity = obj.attributes.institution_city_en || ""
      const toCountry = obj.attributes.institution_country_en || ""

      // Get coordinates
      const fromLat = obj.attributes.latitude
      const fromLng = obj.attributes.longitude

      // Create a key that includes all location info
      const key = `${obj.attributes.place_name}-${obj.attributes.institution_place}`

      if (!arcMap.has(key)) {
        arcMap.set(key, {
          from: obj.attributes.place_name,
          to: obj.attributes.institution_place,
          fromCity,
          fromCountry,
          fromLat,
          fromLng,
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

    return Array.from(arcMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 arcs
  }

  // Extract unique institutions
  const getUniqueInstitutions = () => {
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

    return Array.from(institutionMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 institutions
  }

  // Extract unique origin places
  const getUniqueOrigins = () => {
    const originMap = new Map()

    objects.forEach((obj) => {
      if (!obj.attributes.place_name) return

      if (!originMap.has(obj.attributes.place_name)) {
        originMap.set(obj.attributes.place_name, {
          name: obj.attributes.place_name,
          count: 1,
          city: obj.attributes.city_en,
          country: obj.attributes.country_en,
        })
      } else {
        originMap.get(obj.attributes.place_name).count++
      }
    })

    return Array.from(originMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 origins
  }

  const arcs = getUniqueArcs()
  const institutions = getUniqueInstitutions()
  const origins = getUniqueOrigins()

  // Handle scroll behavior to make panel sticky
  useEffect(() => {
    const handleScroll = () => {
      if (!panelRef.current) return

      if (initialOffsetTop.current === null) {
        initialOffsetTop.current = panelRef.current.offsetTop
      }

      if (window.scrollY > initialOffsetTop.current) {
        setIsSticky(true)
      } else {
        setIsSticky(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div
      ref={panelRef}
      className={`w-full bg-white transition-all duration-300 ${isSticky ? "sticky top-12 z-20" : ""} ${className}`}
    >
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Info</span>
          {!isCollapsed && <span className="text-xs panel-text-muted">{objects.length} items</span>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronUpIcon className="h-5 w-5" />}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="p-2 pt-0 text-xs bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Arcs */}
            <div>
              <h3 className="text-xs panel-text-muted mb-1">Arc</h3>
              <div className="space-y-0.5">
                {arcs.map((arc, index) => (
                  <div
                    key={index}
                    className={`flex flex-col rounded-sm p-1 -mx-1 transition-colors ${onArcClick && arc.fromLat && arc.fromLng
                        ? "cursor-pointer hover:bg-slate-100"
                        : ""
                      }`}
                    onClick={() => {
                      if (onArcClick && arc.fromLat && arc.fromLng) {
                        onArcClick(arc.fromLat, arc.fromLng, 8)
                      }
                    }}
                  >
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
            </div>

            {/* Institutions */}
            <div>
              <h3 className="text-xs panel-text-muted mb-1"> Collection</h3>
              <div className="space-y-0.5">
                {institutions.map((inst, index) => (
                  <div key={index} className="flex flex-col p-1 -mx-1">
                    <div className="flex justify-between">
                      <span className="truncate max-w-[70%]">{inst.name}</span>
                      <span className="ml-2 panel-text-muted">{inst.count}</span>
                    </div>
                    {(inst.city || inst.country) && (
                      <div className="panel-text-muted text-[10px]">
                        {inst.city && inst.country ? `${inst.city}, ${inst.country}` : inst.city || inst.country}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Origins */}
            <div>
              <h3 className="text-xs panel-text-muted mb-1">From</h3>
              <div className="space-y-0.5">
                {origins.map((origin, index) => (
                  <div key={index} className="flex flex-col p-1 -mx-1">
                    <div className="flex justify-between">
                      <span className="truncate max-w-[70%]">{origin.name}</span>
                      <span className="ml-2 panel-text-muted">{origin.count}</span>
                    </div>
                    {(origin.city || origin.country) && (
                      <div className="panel-text-muted text-[10px]">
                        {origin.city && origin.country
                          ? `${origin.city}, ${origin.country}`
                          : origin.city || origin.country}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 pt-1">
            <div className="text-xs panel-text-muted">
              <span>View</span>
            </div>
            <div className="flex gap-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="h-5 px-1 text-xs"
                onClick={() => viewMode !== "grid" && onToggleViewMode()}
              >
                Grid
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-5 px-1 text-xs"
                onClick={() => viewMode !== "list" && onToggleViewMode()}
              >
                Table
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
