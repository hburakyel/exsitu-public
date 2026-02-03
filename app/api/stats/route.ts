import { NextResponse } from "next/server"
import { fetchMuseumObjects } from "@/lib/api"

// In-memory cache for stats
interface StatsCache {
  data: any
  timestamp: number
  isRefreshing: boolean
}

const statsCache: StatsCache = {
  data: null,
  timestamp: 0,
  isRefreshing: false,
}

// Cache duration in milliseconds (10 minutes)
const CACHE_DURATION = 10 * 60 * 1000

// Function to fetch and process stats
async function fetchStats() {
  try {
    // Fetch a larger sample of objects to get better statistics
    const { objects } = await fetchMuseumObjects(
      { north: 90, south: -90, east: 180, west: -180 },
      1,
      500, // Fetch 500 objects to get a good sample
    )

    // Process countries - use country_en directly
    const countries: Record<string, number> = {}
    const cities: Record<string, number> = {}
    const institutions: Record<string, number> = {}

    objects.forEach((obj) => {
      // Use country_en directly from Strapi
      const country = obj.attributes.country_en
      if (country) {
        countries[country] = (countries[country] || 0) + 1
      }

      // Use city_en directly from Strapi
      const city = obj.attributes.city_en
      if (city) {
        cities[city] = (cities[city] || 0) + 1
      }

      // Use institution_name directly from Strapi
      const institution = obj.attributes.institution_name
      if (institution) {
        institutions[institution] = (institutions[institution] || 0) + 1
      }
    })

    // Convert to sorted arrays
    const sortedCountries = Object.entries(countries)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const sortedCities = Object.entries(cities)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    const sortedInstitutions = Object.entries(institutions)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    return {
      countries: sortedCountries,
      cities: sortedCities,
      institutions: sortedInstitutions,
      totalObjects: objects.length,
      timestamp: Date.now(),
    }
  } catch (error) {
    console.error("Error fetching stats:", error)
    throw error
  }
}

// Background refresh function
async function refreshStatsInBackground() {
  if (statsCache.isRefreshing) return

  statsCache.isRefreshing = true
  try {
    const newStats = await fetchStats()
    statsCache.data = newStats
    statsCache.timestamp = Date.now()
    console.log("Stats refreshed in background at", new Date().toISOString())
  } catch (error) {
    console.error("Background stats refresh failed:", error)
  } finally {
    statsCache.isRefreshing = false
  }
}

export async function GET() {
  try {
    const now = Date.now()

    // If cache is empty or expired, fetch synchronously
    if (!statsCache.data || now - statsCache.timestamp > CACHE_DURATION) {
      console.log("Stats cache miss - fetching new data")
      statsCache.data = await fetchStats()
      statsCache.timestamp = now
    } else {
      // If cache is valid but getting older, refresh in background
      if (now - statsCache.timestamp > CACHE_DURATION / 2 && !statsCache.isRefreshing) {
        console.log("Stats cache hit, but refreshing in background")
        refreshStatsInBackground()
      } else {
        console.log("Stats cache hit")
      }
    }

    return NextResponse.json(statsCache.data, {
      headers: {
        "Cache-Control": "public, max-age=600", // 10 minutes
        "X-Cache": "HIT",
        "X-Cache-Timestamp": new Date(statsCache.timestamp).toISOString(),
      },
    })
  } catch (error) {
    console.error("Error in stats API:", error)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
