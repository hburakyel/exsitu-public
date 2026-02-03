import type { MuseumObject, MapBounds, SearchResult } from "../types"

// Simple in-memory cache with bounds-based keys
const apiCache: Record<string, { data: any; timestamp: number }> = {}
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes in milliseconds

// Rate limiting variables
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 1000 // Minimum 1 second between requests

// Function to wait for a specified time
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Generate a cache key for bounds
function getBoundsCacheKey(bounds: MapBounds, page: number, pageSize: number, zoom: number): string {
  // Round bounds to reduce cache fragmentation
  const roundedBounds = {
    north: Math.round(bounds.north * 10) / 10,
    south: Math.round(bounds.south * 10) / 10,
    east: Math.round(bounds.east * 10) / 10,
    west: Math.round(bounds.west * 10) / 10,
  }

  return `bounds:${JSON.stringify(roundedBounds)}:page:${page}:size:${pageSize}:zoom:${Math.floor(zoom)}`
}

// Function to make a rate-limited API request with caching and retry logic
async function fetchWithRateLimit(
  url: string,
  options: RequestInit = {},
  retries = 3,
  cacheKey?: string,
): Promise<any> {
  // Check cache first if a cache key is provided
  if (cacheKey && apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log("Using cached data for:", url)
    return apiCache[cacheKey].data
  }

  // Implement rate limiting
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest
    console.log(`Rate limiting: waiting ${waitTime}ms before next request`)
    await wait(waitTime)
  }

  lastRequestTime = Date.now()

  try {
    console.log("Fetching from API:", url)
    const response = await fetch(url, options)

    if (!response.ok) {
      // Handle rate limiting specifically
      if (response.status === 429) {
        if (retries > 0) {
          // Get retry-after header or use exponential backoff
          const retryAfter =
            Number.parseInt(response.headers.get("retry-after") || "0") * 1000 || Math.pow(2, 4 - retries) * 1000
          console.log(`Rate limited. Retrying after ${retryAfter}ms. Retries left: ${retries - 1}`)
          await wait(retryAfter)
          return fetchWithRateLimit(url, options, retries - 1, cacheKey)
        } else {
          throw new Error(`Rate limit exceeded. Please try again later.`)
        }
      }

      const errorText = await response.text()
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
    }

    const data = await response.json()

    // Cache the successful response if a cache key is provided
    if (cacheKey) {
      apiCache[cacheKey] = { data, timestamp: Date.now() }
    }

    return data
  } catch (error) {
    if (error instanceof Error && error.message.includes("Rate limit") && retries > 0) {
      // Retry with exponential backoff for network errors too
      const retryAfter = Math.pow(2, 4 - retries) * 1000
      console.log(`Network error. Retrying after ${retryAfter}ms. Retries left: ${retries - 1}`)
      await wait(retryAfter)
      return fetchWithRateLimit(url, options, retries - 1, cacheKey)
    }
    throw error
  }
}

// Function to fetch country-level aggregated data
export async function fetchCountryAggregations() {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!apiBaseUrl) {
    console.error("API_BASE_URL is not set")
    throw new Error("API_BASE_URL is not set")
  }

  const cacheKey = "country-aggregations"

  // Check cache first
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log("Using cached country aggregations")
    return apiCache[cacheKey].data
  }

  try {
    // This endpoint should return pre-aggregated country data
    const url = `/api/proxy/aggregations/countries`

    const data = await fetchWithRateLimit(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      3,
      cacheKey,
    )

    return data
  } catch (error) {
    console.error("Error fetching country aggregations:", error)

    // Return mock data if API fails
    return generateMockCountryAggregations()
  }
}

// Function to fetch city-level aggregated data
export async function fetchCityAggregations(bounds: MapBounds) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!apiBaseUrl) {
    console.error("API_BASE_URL is not set")
    throw new Error("API_BASE_URL is not set")
  }

  // Create a cache key based on the bounds
  const cacheKey = `city-aggregations:${JSON.stringify(bounds)}`

  // Check cache first
  if (apiCache[cacheKey] && Date.now() - apiCache[cacheKey].timestamp < CACHE_DURATION) {
    console.log("Using cached city aggregations")
    return apiCache[cacheKey].data
  }

  try {
    // This endpoint should return pre-aggregated city data within the bounds
    const params = new URLSearchParams({
      north: bounds.north.toString(),
      south: bounds.south.toString(),
      east: bounds.east.toString(),
      west: bounds.west.toString(),
    })

    const url = `/api/proxy/aggregations/cities?${params.toString()}`

    const data = await fetchWithRateLimit(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      3,
      cacheKey,
    )

    return data
  } catch (error) {
    console.error("Error fetching city aggregations:", error)

    // Return mock data if API fails
    return generateMockCityAggregations(bounds)
  }
}

// Function to fetch museum objects with optimized fields based on zoom level
export async function fetchMuseumObjects(bounds: MapBounds, page = 1, pageSize = 50, zoom = 0) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!apiBaseUrl) {
    console.error("API_BASE_URL is not set")
    throw new Error("API_BASE_URL is not set")
  }

  // Ensure bounds are valid and not too restrictive
  const validBounds = {
    north: Math.min(bounds.north, 90),
    south: Math.max(bounds.south, -90),
    east: Math.min(bounds.east, 180),
    west: Math.max(bounds.west, -180),
  }

  // Remove the fields parameter as it's causing validation errors
  // Instead, we'll filter the data after receiving it
  const params = new URLSearchParams({
    [`filters[latitude][$gte]`]: validBounds.south.toString(),
    [`filters[latitude][$lte]`]: validBounds.north.toString(),
    [`filters[longitude][$gte]`]: validBounds.west.toString(),
    [`filters[longitude][$lte]`]: validBounds.east.toString(),
    "pagination[pageSize]": pageSize.toString(),
    "pagination[page]": page.toString(),
    populate: "*",
  })

  try {
    const url = `/api/proxy?${params.toString()}`
    console.log("Full API URL being fetched:", url)
    console.log("Bounds used for fetch:", validBounds)

    // Generate a cache key based on the bounds, pagination, and zoom level
    const cacheKey = getBoundsCacheKey(validBounds, page, pageSize, zoom)

    const data = await fetchWithRateLimit(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      3, // 3 retries
      cacheKey, // Pass the cache key
    )

    console.log("API response:", data)

    if (!data || !Array.isArray(data.data)) {
      console.error("Invalid data structure received from API:", data)
      throw new Error("Invalid data structure received from API")
    }

    // If no objects found, log a clear message
    if (data.data.length === 0) {
      console.log("No objects found in the current bounds. Try zooming out or panning to a different area.")
    }

    // Process the data to ensure we use the fields directly
    const processedObjects = data.data.map((obj) => {
      // No need to extract or derive fields - use them directly
      return obj
    })

    return {
      objects: processedObjects,
      pagination: data.meta.pagination,
    }
  } catch (error) {
    console.error("Error fetching museum objects:", error)
    if (error instanceof Error) {
      console.error("Error name:", error.name)
      console.error("Error message:", error.message)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error(
          "This might be a network error. Please check if the API is accessible from the deployed environment.",
        )
      }
      throw new Error(`Failed to fetch museum objects: ${error.message}`)
    } else {
      console.error("Unknown error type:", typeof error)
      throw new Error("An unknown error occurred while fetching museum objects")
    }
  }
}

// Function to fetch a limited set of objects for initial filtering
export async function fetchAllMuseumObjects(pageSize = 50) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
  if (!apiBaseUrl) {
    console.error("API_BASE_URL is not set")
    throw new Error("API_BASE_URL is not set")
  }

  try {
    // First, get the total count with a small request
    const countParams = new URLSearchParams({
      "pagination[pageSize]": "1",
      "pagination[page]": "1",
    })

    const countUrl = `/api/proxy?${countParams.toString()}`
    const countData = await fetchWithRateLimit(countUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const totalCount = countData.meta.pagination.total

    // Increase pageSize to get more objects for better arc selection
    const actualPageSize = Math.min(200, pageSize) // Get up to 200 objects for better selection

    console.log(`Fetching ${actualPageSize} objects (total available: ${totalCount})`)

    // Remove the fields parameter as it's causing validation errors
    const params = new URLSearchParams({
      "pagination[pageSize]": actualPageSize.toString(),
      "pagination[page]": "1",
      populate: "*",
    })

    const url = `/api/proxy?${params.toString()}`
    console.log(`Fetching initial data:`, url)

    const data = await fetchWithRateLimit(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!data || !Array.isArray(data.data)) {
      console.error("Invalid data structure received from API:", data)
      throw new Error("Invalid data structure received from API")
    }

    // Process the data to ensure we use the fields directly
    const processedObjects = data.data.map((obj) => {
      // No need to extract or derive fields - use them directly
      return obj
    })

    console.log(`Successfully fetched ${processedObjects.length} objects for initial load`)

    return {
      objects: processedObjects,
      pagination: {
        page: 1,
        pageSize: processedObjects.length,
        pageCount: Math.ceil(totalCount / actualPageSize),
        total: totalCount,
      },
    }
  } catch (error) {
    console.error("Error fetching all museum objects:", error)

    // Return empty data instead of mock data
    return {
      objects: [],
      pagination: {
        page: 1,
        pageSize: pageSize,
        pageCount: 1,
        total: 0,
      },
    }
  }
}

// Function to generate mock objects for testing - MODIFIED to return empty array
function generateMockObjects(count: number): MuseumObject[] {
  // Return empty array instead of fake data
  return []
}

// Function to generate mock country aggregations - MODIFIED to return empty data
function generateMockCountryAggregations() {
  return {
    data: [],
    meta: {
      total: 0,
    },
  }
}

// Function to generate mock city aggregations - MODIFIED to return empty data
function generateMockCityAggregations(bounds: MapBounds) {
  return {
    data: [],
    meta: {
      total: 0,
    },
  }
}

// Update the searchLocation function to handle errors better
// Find the searchLocation function and update it to ensure it's working correctly:
export async function searchLocation(query: string): Promise<SearchResult | null> {
  try {
    // Use our server-side proxy instead of calling Mapbox directly
    const params = new URLSearchParams({
      endpoint: "geocoding",
      query: query,
      limit: "1",
      types: "place,locality,region,country",
      language: "en",
      fuzzyMatch: "true",
    })

    const url = `/api/mapbox-proxy?${params.toString()}`
    console.log("Searching location with URL:", url)

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Search API returned status: ${response.status}`)
    }

    const data = await response.json()
    console.log("Mapbox API response:", JSON.stringify(data))

    if (data.features?.length > 0) {
      const [lng, lat] = data.features[0].center
      const placeName = data.features[0].place_name
        .split(",")
        .map((part: string) => part.trim())
        .filter((part: string) => part !== "")
        .slice(0, 2)
        .join(", ")

      console.log("Found location:", { name: placeName, longitude: lng, latitude: lat })

      return {
        name: placeName,
        longitude: lng,
        latitude: lat,
      }
    }

    console.log("No location found for query:", query)
    return null
  } catch (error) {
    console.error("Error searching location:", error)
    // Return null instead of throwing to prevent breaking the UI
    return null
  }
}

// Function to clear the cache
export function clearApiCache() {
  Object.keys(apiCache).forEach((key) => delete apiCache[key])
  console.log("API cache cleared")
}

export async function getMapboxToken(): Promise<string> {
  try {
    const response = await fetch("/api/mapbox-token")
    if (!response.ok) {
      throw new Error(`Failed to fetch Mapbox token: ${response.status}`)
    }
    const data = await response.json()
    return data.token
  } catch (error) {
    console.error("Error fetching Mapbox token:", error)
    throw error
  }
}
