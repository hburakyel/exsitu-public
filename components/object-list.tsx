"use client"

import { useState, useEffect } from "react"
import type { MuseumObject } from "../types"
import { Spinner } from "@/components/ui/spinner"
import { useInView } from "react-intersection-observer"
import { useMediaQuery } from "../hooks/use-media-query"
import { ExternalLink } from "lucide-react"

interface ObjectListProps {
  objects: MuseumObject[]
  onLoadMore: () => void
  hasMore: boolean
  totalCount: number
  isLoading: boolean
  onObjectClick: (longitude: number, latitude: number, index: number) => void
}

export default function ObjectList({
  objects,
  onLoadMore,
  hasMore,
  totalCount,
  isLoading,
  onObjectClick,
}: ObjectListProps) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Load more when reaching the end of the list
  useEffect(() => {
    if (inView && hasMore && !isLoading) {
      onLoadMore()
    }
  }, [inView, hasMore, isLoading, onLoadMore])

  const handleItemClick = (object: MuseumObject, index: number) => {
    if (object.attributes.longitude && object.attributes.latitude) {
      onObjectClick(object.attributes.longitude, object.attributes.latitude, index)
    }
  }

  // Helper function to get link information
  const getLinkInfo = (object: MuseumObject) => {
    // Check if object_links exists and has items
    if (
      object.attributes.object_links &&
      Array.isArray(object.attributes.object_links) &&
      object.attributes.object_links.length > 0
    ) {
      const linkText = object.attributes.object_links[0].link_text || ""
      return {
        url: linkText,
        text: linkText, // Use link_text as the display text
      }
    }

    // Fallback to source_link if object_links is not available
    if (object.attributes.source_link) {
      return {
        url: object.attributes.source_link,
        text: object.attributes.source_link, // Use the URL as the display text
      }
    }

    // If we have a direct link_text property, use that
    if (object.attributes.link_text) {
      return {
        url: object.attributes.link_text,
        text: object.attributes.link_text, // Use the URL as the display text
      }
    }

    return {
      url: "",
      text: "None",
    }
  }

  if (isLoading && objects.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-white pt-0 pb-4 pl-4 pr-4">
      {/* CSV-like header */}
      {!isMobile ? (
        <div className="sticky top-0 bg-white py-2 z-10 text-sm text-gray-500 mb-2">
          <div className="grid grid-cols-[60px_minmax(100px,1fr)_minmax(80px,100px)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] gap-2">
            <div>Image</div>
            <div className="truncate">Title</div>
            <div className="truncate">ID</div>
            <div className="truncate">From</div>
            <div className="truncate">To</div>
            <div className="truncate">Institution</div>
            <div className="truncate">Link</div>
          </div>
        </div>
      ) : (
        <div className="sticky top-0 bg-white py-2 z-10 text-sm text-gray-500 mb-2">
          <div className="grid grid-cols-[60px_1fr] gap-2">
            <div>Image</div>
            <div>Details</div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {objects.map((object, index) => {
          const linkInfo = getLinkInfo(object)

          return !isMobile ? (
            <div
              key={object.id}
              className={`grid grid-cols-[60px_minmax(100px,1fr)_minmax(80px,100px)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] gap-2 items-center px-2 py-2 hover:ring-2 hover:ring-blue-500 cursor-pointer rounded-md bg-white ${
                selectedId === object.id ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => {
                setSelectedId(object.id)
                handleItemClick(object, index)
              }}
            >
              {/* Desktop layout - keep existing code */}
              {/* Image preview */}
              <div className="w-12 h-12 bg-white rounded overflow-hidden flex items-center justify-center">
                {object.attributes.img_url ? (
                  <img
                    src={object.attributes.img_url || "/placeholder.svg"}
                    alt={object.attributes.title || "Object"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg?height=48&width=48"
                    }}
                  />
                ) : (
                  <span className="text-xs text-gray-500">No img</span>
                )}
              </div>

              {/* CSV-like data display */}
              <div className="text-sm truncate">
                {object.attributes.title || object.attributes.inventory_number || "Untitled"}
              </div>
              <div className="text-sm truncate">{object.attributes.inventory_number || "N/A"}</div>
              <div className="text-sm truncate">{object.attributes.place_name || "Unknown"}</div>
              <div className="text-sm truncate">{object.attributes.institution_place || "Unknown"}</div>
              <div className="text-sm truncate">{object.attributes.institution_name || "Unknown"}</div>
              <div className="text-sm truncate">
                {linkInfo.url ? (
                  <a
                    href={linkInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()} // Prevent row click when clicking the link
                  >
                    {linkInfo.text}
                  </a>
                ) : (
                  "None"
                )}
              </div>
            </div>
          ) : (
            // Mobile-optimized layout
            <div
              key={object.id}
              className={`grid grid-cols-[60px_1fr] gap-4 p-3 hover:ring-2 hover:ring-blue-500 cursor-pointer rounded-md bg-white ${
                selectedId === object.id ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => {
                setSelectedId(object.id)
                handleItemClick(object, index)
              }}
            >
              {/* Image preview */}
              <div className="w-14 h-14 bg-white rounded overflow-hidden flex items-center justify-center">
                {object.attributes.img_url ? (
                  <img
                    src={object.attributes.img_url || "/placeholder.svg"}
                    alt={object.attributes.title || "Object"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg?height=56&width=56"
                    }}
                  />
                ) : (
                  <span className="text-xs text-gray-500">No img</span>
                )}
              </div>

              {/* Mobile-optimized details */}
              <div className="flex flex-col">
                <div className="text-sm font-medium truncate">
                  {object.attributes.title || object.attributes.inventory_number || "Untitled"}
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-1">
                  <div className="text-xs">
                    <span className="text-gray-500">ID: </span>
                    <span>{object.attributes.inventory_number || "N/A"}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">From: </span>
                    <span className="truncate">{object.attributes.place_name || "Unknown"}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">To: </span>
                    <span className="truncate">{object.attributes.institution_place || "Unknown"}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">Collection: </span>
                    <span className="truncate">{object.attributes.institution_name || "Unknown"}</span>
                  </div>
                </div>
                {linkInfo.url && (
                  <div className="mt-1">
                    <a
                      href={linkInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      <span className="truncate">View source</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {objects.length === 0 && !isLoading && (
        <div className="text-center py-8 text-sm text-gray-500 bg-white">No objects found in this area.</div>
      )}

      {hasMore && <div ref={ref} className="h-10" />}
      {isLoading && objects.length > 0 && (
        <div className="flex justify-center items-center h-10">
          <Spinner className="h-6 w-6" />
        </div>
      )}
    </div>
  )
}
