import "./globals.css"
import type React from "react"
import ClientMapboxCSS from "@/components/client-mapbox-css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientMapboxCSS />
        {children}
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.dev'
    };
