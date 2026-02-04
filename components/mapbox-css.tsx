"use client"

import { useEffect } from "react"

export default function MapboxCSS() {
  useEffect(() => {
    // Add the Mapbox CSS link
    const mapboxLink = document.createElement("link")
    mapboxLink.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css"
    mapboxLink.rel = "stylesheet"
    document.head.appendChild(mapboxLink)

    // Add the MapLibre CSS link
    const maplibreLink = document.createElement("link")
    maplibreLink.href = "https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css"
    maplibreLink.rel = "stylesheet"
    document.head.appendChild(maplibreLink)

    return () => {
      // Clean up
      document.head.removeChild(mapboxLink)
      document.head.removeChild(maplibreLink)
    }
  }, [])

  return null
}
