"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MuseumObject } from "../types"
import { Spinner } from "@/components/ui/spinner"

interface ImageGalleryProps {
  objects: MuseumObject[]
  initialIndex: number
  onClose: () => void
  isFullscreen?: boolean
  isMobile?: boolean
}

export default function ImageGallery({
  objects,
  initialIndex,
  onClose,
  isFullscreen = false,
  isMobile = false,
}: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentObject = objects && objects.length > 0 ? objects[currentIndex] : null

  // Log container width on mount and resize
  useEffect(() => {
    if (containerRef.current) {
      console.log("Gallery container width:", containerRef.current.offsetWidth)

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          console.log("Gallery container resized to:", entry.contentRect.width)
        }
      })

      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }
  }, [])

  useEffect(() => {
    // Reset image error state when changing images
    setImageError(false)
    setIsLoading(true)
  }, [currentIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowRight") {
        handleNext()
      } else if (e.key === "ArrowLeft") {
        handlePrevious()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [currentIndex, objects.length, onClose])

  const handleNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % objects.length)
  }, [objects.length])

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + objects.length) % objects.length)
  }, [objects.length])

  const handleImageLoad = () => {
    setIsLoading(false)
  }

  // Add early return if no valid objects or current object
  if (!objects || objects.length === 0 || !currentObject) {
    console.error("Image gallery cannot open: No valid objects or current object")
    return null
  }

  // Check if the object has links
  const hasObjectLinks = currentObject.attributes.object_links && currentObject.attributes.object_links.length > 0

  // Get the correct URL to open
  const getLinkUrl = () => {
    // Check if object_links exists and has items
    if (
      currentObject.attributes.object_links &&
      Array.isArray(currentObject.attributes.object_links) &&
      currentObject.attributes.object_links.length > 0
    ) {
      return currentObject.attributes.object_links[0].link_text || currentObject.attributes.object_links[0].url || null
    }

    // Fallback to source_link if object_links is not available
    if (currentObject.attributes.source_link) {
      return currentObject.attributes.source_link
    }

    // If we have a direct link_text property, use that
    if (currentObject.attributes.link_text) {
      return currentObject.attributes.link_text
    }

    return null
  }

  // Fixed width for default size
  const galleryWidth = isFullscreen ? "100%)" : "100%"

  return (
    <>
      {/* Overlay that covers the entire screen */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          backdropFilter: "blur(8px)",
          zIndex: 40,
        }}
        onClick={onClose}
      />

      {/* Gallery container with fixed width */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: isMobile ? "0" : "50%",
          left: isMobile ? "0" : "50%",
          bottom: isMobile ? "0" : "auto",
          right: isMobile ? "0" : "auto",
          transform: isMobile ? "none" : "translate(-50%, -50%)",
          width: isMobile ? "100%" : "100%",
          height: isMobile ? "100%" : "100%",
          maxHeight: isMobile ? "100%" : "100%",
          backgroundColor: "white",
          color: "black",
          borderRadius: isMobile ? "0" : "8px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          zIndex: 50,
          border: "none",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header with navigation controls */}
        <div
          style={{
            padding: isMobile ? "16px" : "12px",
            borderBottom: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "white",
          }}
        >
          <div style={{ fontSize: "14px" }}>
            <span style={{ color: "black" }}>
              {currentIndex + 1} / {objects.length}
            </span>
            {currentObject.attributes.inventory_number && (
              <span style={{ color: "#666", marginLeft: "8px" }}>
                ID: <span style={{ color: "black" }}>{currentObject.attributes.inventory_number}</span>
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="ghost" size="icon" onClick={handlePrevious} className={isMobile ? "h-8 w-8" : "h-6 w-6"}>
              <ChevronLeft className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
            </Button>

            <Button variant="ghost" size="icon" onClick={handleNext} className={isMobile ? "h-8 w-8" : "h-6 w-6"}>
              <ChevronRight className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
            </Button>

            {/* External link button */}
            {hasObjectLinks && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  const url = getLinkUrl()
                  if (url) {
                    window.open(url, "_blank")
                  }
                }}
                className={isMobile ? "h-8 w-8" : "h-6 w-6"}
              >
                <ExternalLink className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={onClose} className={isMobile ? "h-8 w-8" : "h-6 w-6"}>
              <X className={isMobile ? "h-4 w-4" : "h-3 w-3"} />
            </Button>
          </div>
        </div>

        {/* Subheader with object details */}
        <div
          style={{
            padding: "8px 16px",
            borderBottom: "none",
            fontSize: "14px",
            backgroundColor: "white",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <span style={{ color: "var(--panel-text-muted, #666)" }}>From: </span>
              <span>{currentObject.attributes.place_name || "Unknown"}</span>
            </div>
            <div>
              <span style={{ color: "var(--panel-text-muted, #666)" }}>To: </span>
              <span>{currentObject.attributes.institution_place || "Unknown"}</span>
            </div>
            <div>
              <span style={{ color: "var(--panel-text-muted, #666)" }}>Collection: </span>
              <span>{currentObject.attributes.institution_name || "Unknown"}</span>
            </div>
          </div>
        </div>

        {/* Main image container */}
        <div
          style={{
            flex: "1 1 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            minHeight: "0",
            backgroundColor: "white",
          }}
        >
          {isLoading && !imageError && (
            <div
              style={{
                position: "absolute",
                inset: "0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Spinner className="h-8 w-8" />
            </div>
          )}

          {!imageError ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "white",
              }}
            >
              <img
                src={currentObject.attributes.img_url || ""}
                alt={currentObject.attributes.title || "Museum object"}
                style={{
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  backgroundColor: "white", // Changed from black to white
                  margin: "0",
                  padding: "0",
                  display: "block",
                }}
                onError={() => setImageError(true)}
                onLoad={handleImageLoad}
              />
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                height: "100%",
                width: "100%",
                backgroundColor: "white", // Added white background
              }}
            >
              <span style={{ color: "#999", fontSize: "14px" }}>
                {currentObject.attributes.inventory_number || "No image available"}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
