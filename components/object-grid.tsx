"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import type { MuseumObject } from "../types"
import { Spinner } from "@/components/ui/spinner"
import { useInView } from "react-intersection-observer"

interface ObjectGridProps {
  objects: MuseumObject[]
  onLoadMore: () => void
  hasMore: boolean
  totalCount: number
  isLoading: boolean
  onObjectClick?: (longitude: number, latitude: number, index: number) => void
  isFullscreen?: boolean
  panelSize?: number
  mobileColumns?: number
}

export default function ObjectGrid({
  objects,
  onLoadMore,
  hasMore,
  totalCount,
  isLoading,
  onObjectClick = () => {},
  isFullscreen = false,
  panelSize = 50,
  mobileColumns = 2,
}: ObjectGridProps) {
  const { ref: observerRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  })

  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})
  const [gridClass, setGridClass] = useState("")
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)

  // Use virtualization for better performance with large lists
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate visible objects based on current range
  const visibleObjects = useMemo(() => {
    return objects.slice(visibleRange.start, visibleRange.end)
  }, [objects, visibleRange])

  // Load more when reaching the end of the list
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      onLoadMore()
    }
  }, [inView, hasMore, isLoading, onLoadMore])

  // Handle scroll to load more visible items
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const { scrollTop, clientHeight, scrollHeight } = containerRef.current
    const scrollPosition = scrollTop + clientHeight

    // If we're near the bottom of our current range, load more items
    if (scrollPosition > scrollHeight - 200 && visibleRange.end < objects.length) {
      setVisibleRange((prev) => ({
        start: prev.start,
        end: Math.min(prev.end + 20, objects.length),
      }))
    }

    // If we've scrolled up significantly, adjust the start range to improve performance
    if (scrollTop < 200 && visibleRange.start > 0) {
      setVisibleRange((prev) => ({
        start: Math.max(prev.start - 20, 0),
        end: prev.end,
      }))
    }
  }, [objects.length, visibleRange])

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true })
      return () => container.removeEventListener("scroll", handleScroll)
    }
  }, [handleScroll])

  // Dynamically adjust grid columns based on panel size
  useEffect(() => {
    // Calculate columns based on panel size
    // For full-screen mode (panelSize = 100), use 8 columns
    let columns: string

    if (isFullscreen || panelSize >= 90) {
      columns = `grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8`
    } else if (panelSize <= 30) {
      columns = `grid-cols-${mobileColumns} xs:grid-cols-${mobileColumns} sm:grid-cols-${mobileColumns} md:grid-cols-${mobileColumns} lg:grid-cols-${mobileColumns} xl:grid-cols-${mobileColumns} 2xl:grid-cols-${mobileColumns}`
    } else if (panelSize <= 40) {
      columns = `grid-cols-${mobileColumns} xs:grid-cols-${mobileColumns} sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3`
    } else if (panelSize <= 50) {
      columns = `grid-cols-${mobileColumns} xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4`
    } else if (panelSize <= 60) {
      columns = `grid-cols-${mobileColumns} xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5`
    } else if (panelSize <= 70) {
      columns = `grid-cols-${mobileColumns} xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-6`
    } else if (panelSize <= 80) {
      columns = `grid-cols-${mobileColumns} xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-7`
    } else {
      columns = `grid-cols-${mobileColumns} xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8`
    }

    setGridClass(columns)
  }, [panelSize, isFullscreen, mobileColumns])

  // Reset visible range when objects change significantly
  useEffect(() => {
    setVisibleRange({ start: 0, end: 50 })
  }, [objects.length === 0])

  const handleImageClick = (index: number) => {
    const object = objects[visibleRange.start + index]
    if (object && object.attributes.longitude && object.attributes.latitude) {
      onObjectClick(object.attributes.longitude, object.attributes.latitude, visibleRange.start + index)
    }
  }

  const handleImageError = (id: string) => {
    console.log(`Image failed to load for object ${id}`)
    setBrokenImages((prev) => ({
      ...prev,
      [id]: true,
    }))
  }

  if (isLoading && objects.length === 0) {
    return (
      <div className="flex justify-center items-center h-full bg-white">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (objects.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-full p-4 text-center bg-white">
        <p className="text-sm text-gray-500 mb-4">No objects found in this area.</p>
        <p className="text-xs text-gray-500">Try zooming out or panning to a different location on the map.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto px-4 pt-4 pb-4 bg-white">
      <div className={`grid ${gridClass} gap-3`}>
        {visibleObjects.map((object, index) => {
          const isSelected = object.id === selectedImageId

          return (
            <div
              key={object.id}
              className={`group relative cursor-pointer overflow-hidden rounded-md transition-all duration-200 bg-white ${
                isSelected ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => handleImageClick(index)}
              onMouseEnter={() => setSelectedImageId(object.id)}
              onMouseLeave={() => setSelectedImageId(null)}
            >
              <div className="relative w-full pt-[100%] overflow-hidden bg-white">
                {!brokenImages[object.id] ? (
                  <img
                    src={object.attributes?.img_url || ""}
                    alt={object.attributes?.title || "Museum object"}
                    className="absolute inset-0 w-full h-full object-contain bg-white"
                    onError={() => handleImageError(object.id)}
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-center p-2 bg-white">
                    <span className="text-gray-500 text-xs">
                      {object.attributes.inventory_number || "Image unavailable"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && <div ref={observerRef} className="h-10" />}
      {isLoading && objects.length > 0 && (
        <div className="flex justify-center items-center h-10">
          <Spinner className="h-6 w-6" />
        </div>
      )}
    </div>
  )
}
