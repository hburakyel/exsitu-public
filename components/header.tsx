"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export default function Header() {
  const [visible, setVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Make header visible if scrolling up or at the top
      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        setVisible(true)
      }
      // Hide header if scrolling down and not at the top
      else if (currentScrollY > 100 && currentScrollY > lastScrollY) {
        setVisible(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  return (
    <header
      className={`fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 transition-transform duration-300 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          Ex-Situ
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/about" className="text-sm hover:underline">
            About
          </Link>
          <Link href="/institutions" className="text-sm hover:underline">
            Institutions
          </Link>
          <Link href="/map" className="text-sm hover:underline">
            Map
          </Link>
        </nav>
      </div>
    </header>
  )
}
