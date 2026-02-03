"use client"
import dynamic from "next/dynamic"

// Import the MapboxCSS component with ssr: false
const MapboxCSS = dynamic(() => import("@/components/mapbox-css"), { ssr: false })

export default function ClientMapboxCSS() {
  return <MapboxCSS />
}
