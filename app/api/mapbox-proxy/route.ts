import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  const query = searchParams.get("query")

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint parameter" }, { status: 400 })
  }

  // Validate endpoint to prevent security issues
  const validEndpoints = ["geocoding"]
  if (!validEndpoints.includes(endpoint)) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  }

  try {
    let url = ""
    const mapboxToken = process.env.MAPBOX_TOKEN

    if (!mapboxToken) {
      return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 })
    }

    if (endpoint === "geocoding" && query) {
      // Build the Mapbox geocoding URL
      const params = new URLSearchParams({
        access_token: mapboxToken,
        limit: searchParams.get("limit") || "1",
        types: searchParams.get("types") || "place,locality,region,country",
        language: searchParams.get("language") || "en",
        fuzzyMatch: searchParams.get("fuzzyMatch") || "true",
      })

      url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
    } else if (endpoint === "geocoding") {
      // Reverse geocoding
      const lng = searchParams.get("lng")
      const lat = searchParams.get("lat")

      if (!lng || !lat) {
        return NextResponse.json({ error: "Missing lng or lat parameters for reverse geocoding" }, { status: 400 })
      }

      const params = new URLSearchParams({
        access_token: mapboxToken,
        types: searchParams.get("types") || "place",
      })

      url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?${params}`
    }

    const response = await fetch(url)
    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error proxying Mapbox request:", error)
    return NextResponse.json({ error: "Failed to proxy request to Mapbox" }, { status: 500 })
  }
}
