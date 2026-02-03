"use client"

import { useEffect } from "react"

export default function MapboxCSS() {
  useEffect(() => {
    // Add the CSS link directly to the head
    const link = document.createElement("link")
    link.href = "https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    return () => {
      // Clean up
      document.head.removeChild(link)
    }
  }, [])

  return null
}
