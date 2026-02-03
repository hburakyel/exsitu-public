"use client"

import { useState } from "react"
import type { MuseumObject } from "../types"
import { Spinner } from "@/components/ui/spinner"
import { ExternalLinkIcon } from "@radix-ui/react-icons"
import { useInView } from "react-intersection-observer"
import ImageGallery from "./image-gallery"

interface ListViewProps {
  objects: MuseumObject[]
  onLoadMore: () => void
  hasMore: boolean
  totalCount: number
  isLoading: boolean
  onObjectClick: (longitude: number, latitude: number) => void
}

export default function ListView({
  objects,
  onLoadMore,
  hasMore,
  totalCount,
  isLoading,
  onObjectClick,
}: ListViewProps) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  })

  const [galleryOpen, setGalleryOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Load more when reaching the end of the list
  if (inView && hasMore && !isLoading) {
    onLoadMore()
  }

  const handleItemClick = (index: number) => {
    const object = objects[index]
    if (object && object.attributes.longitude && object.attributes.latitude) {
      onObjectClick(object.attributes.longitude, object.attributes.latitude)
      setSelectedIndex(index)
      setGalleryOpen(true)
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
    <div className="container mx-auto p-4 space-y-4">
      {/* Display total count at the top */}
      <div className="text-sm text-gray-600 mb-2">
        Showing {objects.length} of {totalCount} object{totalCount !== 1 ? "s" : ""}
      </div>

      <div className="space-y-4">
        {objects.map((object, index) => (
          <div
            key={object.id}
            className="flex flex-col md:flex-row gap-4 p-4 border border-gray-200 rounded-lg hover:ring-2 hover:ring-blue-500 cursor-pointer transition-all"
            onClick={() => handleItemClick(index)}
          >
            <div className="w-full md:w-48 h-48 relative flex-shrink-0">
              {object.attributes?.img_url ? (
                <img
                  src={object.attributes.img_url || "/placeholder.svg"}
                  alt={object.attributes?.title || "Museum object"}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    e.currentTarget.nextElementSibling!.style.display = "flex"
                  }}
                />
              ) : null}
              <div
                className={`absolute inset-0 flex items-center justify-center text-center p-2 ${object.attributes?.img_url ? "hidden" : "flex"}`}
              >
                <span className="text-gray-600 text-sm">{object.attributes.inventory_number || "No ID"}</span>
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-medium mb-2">
                {object.attributes.title || object.attributes.inventory_number || "Untitled Object"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">From: </span>
                  <span>{object.attributes.place_name || "Unknown"}</span>
                </div>

                <div>
                  <span className="text-gray-600">To: </span>
                  <span>{object.attributes.institution_name || "Unknown"}</span>
                </div>

                <div>
                  <span className="text-gray-600">Institution: </span>
                  <span>{object.attributes.institution_place || "Unknown"}</span>
                </div>

                <div>
                  <span className="text-gray-600">ID: </span>
                  <span>{object.attributes.inventory_number || "Unknown"}</span>
                </div>
              </div>

              <div className="mt-4 text-xs">
                <span className="text-gray-600">Link: </span>
                {object.attributes.link_text ? (
                  <a
                    href={object.attributes.img_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                    <span className="truncate">{object.attributes.link_text}</span>
                  </a>
                ) : (
                  <span>None</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {objects.length === 0 && !isLoading && (
        <div className="text-center py-8 text-sm text-gray-600">No objects found in this area.</div>
      )}

      {hasMore && <div ref={ref} className="h-10" />}
      {isLoading && objects.length > 0 && (
        <div className="flex justify-center items-center h-10">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {galleryOpen && (
        <ImageGallery objects={objects} initialIndex={selectedIndex} onClose={() => setGalleryOpen(false)} />
      )}
    </div>
  )
}
