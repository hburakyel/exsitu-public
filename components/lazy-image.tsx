"use client"

import { useState, useEffect } from "react"
import Image from "next/image"

interface LazyImageProps {
  src: string
  alt: string
  width: number
  height: number
}

export default function LazyImage({ src, alt, width, height }: LazyImageProps) {
  const [isLoading, setLoading] = useState(true)
  const [currentSrc, setCurrentSrc] = useState(`${src}?w=10&q=10`)

  useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      setLoading(false)
      setCurrentSrc(src)
    }
  }, [src])

  return (
    <div className="relative overflow-hidden">
      <Image
        alt={alt}
        src={currentSrc || "/placeholder.svg"}
        width={width}
        height={height}
        className={`
          duration-700 ease-in-out
          ${isLoading ? "scale-110 blur-lg grayscale" : "scale-100 blur-0 grayscale-0"}
        `}
        onLoadingComplete={() => setLoading(false)}
      />
    </div>
  )
}
