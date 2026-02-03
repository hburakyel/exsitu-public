import type { MuseumObject } from "../types"

// Define a type for clustered arcs
export interface ClusteredArc {
  id: string
  sourcePosition: [number, number]
  targetPosition: [number, number]
  count: number
  objects: MuseumObject[]
  level?: "country" | "city" | "object"
}

// Define a type for country-level aggregation
export interface CountryAggregation {
  country: string
  count: number
  latitude: number
  longitude: number
  objects: MuseumObject[]
}

// Function to count unique arcs in the dataset
export function countUniqueArcs(objects: MuseumObject[] = []): number {
  if (!objects || objects.length === 0) {
    return 0
  }

  // Create a Set to store unique source-target pairs
  const uniqueArcs = new Set<string>()

  // Filter objects with valid coordinates
  const validObjects = objects.filter(
    (obj) =>
      obj.attributes?.institution_longitude !== undefined &&
      obj.attributes?.institution_longitude !== null &&
      obj.attributes?.institution_latitude !== undefined &&
      obj.attributes?.institution_latitude !== null &&
      obj.attributes?.longitude !== undefined &&
      obj.attributes?.longitude !== null &&
      obj.attributes?.latitude !== undefined &&
      obj.attributes?.latitude !== null &&
      !isNaN(obj.attributes.longitude) &&
      !isNaN(obj.attributes.latitude) &&
      !isNaN(obj.attributes.institution_longitude) &&
      !isNaN(obj.attributes.institution_latitude),
  )

  // Count unique arcs (where source and target are different)
  validObjects.forEach((obj) => {
    const sourcePos = [obj.attributes.longitude.toFixed(2), obj.attributes.latitude.toFixed(2)]
    const targetPos = [obj.attributes.institution_longitude.toFixed(2), obj.attributes.institution_latitude.toFixed(2)]

    // Skip if source and target are the same (no movement)
    if (sourcePos[0] === targetPos[0] && sourcePos[1] === targetPos[1]) {
      return
    }

    // Create a unique key for this source-target pair
    const key = `${sourcePos[0]},${sourcePos[1]}-${targetPos[0]},${targetPos[1]}`
    uniqueArcs.add(key)
  })

  return uniqueArcs.size
}

// Update the aggregateByCountry function to use country_en directly

export function aggregateByCountry(objects: MuseumObject[]): CountryAggregation[] {
  if (!objects || objects.length === 0) {
    return []
  }

  const countryMap = new Map<string, CountryAggregation>()

  objects.forEach((obj) => {
    // Use country_en field directly
    const country = obj.attributes.country_en || "Unknown"

    if (!country || country === "Unknown") return

    if (!countryMap.has(country)) {
      countryMap.set(country, {
        country,
        count: 0,
        latitude: 0,
        longitude: 0,
        objects: [],
      })
    }

    const aggregation = countryMap.get(country)!
    aggregation.count++
    aggregation.objects.push(obj)

    // Update the average coordinates for the country
    // Only use valid coordinates
    if (obj.attributes.latitude && obj.attributes.longitude) {
      if (aggregation.latitude === 0 && aggregation.longitude === 0) {
        aggregation.latitude = obj.attributes.latitude
        aggregation.longitude = obj.attributes.longitude
      } else {
        // Simple averaging - could be improved with a more sophisticated approach
        aggregation.latitude = (aggregation.latitude + obj.attributes.latitude) / 2
        aggregation.longitude = (aggregation.longitude + obj.attributes.longitude) / 2
      }
    }
  })

  return Array.from(countryMap.values())
}

// Function to create country-level arcs - only using real data
export function createCountryArcs(countryAggregations: CountryAggregation[]): ClusteredArc[] {
  // Return empty array - we'll only show real arcs from actual objects
  return []
}

// Function to cluster arcs with the same origin/destination
export function clusterArcs(objects: MuseumObject[], maxArcs = 2000): ClusteredArc[] {
  // Create a map to store clusters
  const clusters: Map<string, ClusteredArc> = new Map()

  // Filter objects with valid coordinates first to avoid unnecessary processing
  const validObjects = objects.filter(
    (obj) =>
      obj.attributes?.institution_longitude !== undefined &&
      obj.attributes?.institution_longitude !== null &&
      obj.attributes?.institution_latitude !== undefined &&
      obj.attributes?.institution_latitude !== null &&
      obj.attributes?.longitude !== undefined &&
      obj.attributes?.longitude !== null &&
      obj.attributes?.latitude !== undefined &&
      obj.attributes?.latitude !== null &&
      !isNaN(obj.attributes.longitude) &&
      !isNaN(obj.attributes.latitude) &&
      !isNaN(obj.attributes.institution_longitude) &&
      !isNaN(obj.attributes.institution_latitude),
  )

  // Early return if no valid objects
  if (validObjects.length === 0) {
    return []
  }

  // Create clusters based on source and target positions
  validObjects.forEach((obj) => {
    try {
      const sourcePos: [number, number] = [obj.attributes.longitude, obj.attributes.latitude]
      const targetPos: [number, number] = [obj.attributes.institution_longitude, obj.attributes.institution_latitude]

      // Skip if source and target are the same (no movement)
      if (sourcePos[0] === targetPos[0] && sourcePos[1] === targetPos[1]) {
        return
      }

      // Create a unique key for this source-target pair
      // Round to 2 decimal places to increase clustering
      const key = `${sourcePos[0].toFixed(2)},${sourcePos[1].toFixed(2)}-${targetPos[0].toFixed(2)},${targetPos[1].toFixed(2)}`

      if (clusters.has(key)) {
        // Add to existing cluster
        const cluster = clusters.get(key)!
        cluster.count++
        cluster.objects.push(obj)
      } else {
        // Create new cluster
        clusters.set(key, {
          id: key,
          sourcePosition: sourcePos,
          targetPosition: targetPos,
          count: 1,
          objects: [obj],
          level: "object",
        })
      }
    } catch (error) {
      console.error("Error processing object for arc:", error, obj)
      // Skip this object if there's an error
    }
  })

  // Convert map to array
  let clusteredArcs = Array.from(clusters.values())

  // If we have too many arcs, reduce them further based on count
  if (clusteredArcs.length > maxArcs) {
    // Sort by count (descending)
    clusteredArcs.sort((a, b) => b.count - a.count)
    // Take only the top maxArcs
    clusteredArcs = clusteredArcs.slice(0, maxArcs)
  }

  return clusteredArcs
}

// Update the clusterArcsByCity function to use city_en directly

export function clusterArcsByCity(objects: MuseumObject[], maxArcs = 500): ClusteredArc[] {
  // Create a map to store city clusters
  const cityClusters: Map<string, ClusteredArc> = new Map()

  // Filter objects with valid coordinates and city information
  const validObjects = objects.filter(
    (obj) =>
      obj.attributes?.institution_longitude !== undefined &&
      obj.attributes?.institution_longitude !== null &&
      obj.attributes?.institution_latitude !== undefined &&
      obj.attributes?.institution_latitude !== null &&
      obj.attributes?.longitude !== undefined &&
      obj.attributes?.longitude !== null &&
      obj.attributes?.latitude !== undefined &&
      obj.attributes?.latitude !== null &&
      !isNaN(obj.attributes.longitude) &&
      !isNaN(obj.attributes.latitude) &&
      !isNaN(obj.attributes.institution_longitude) &&
      !isNaN(obj.attributes.institution_latitude) &&
      obj.attributes.city_en, // Use city_en directly
  )

  // Early return if no valid objects
  if (validObjects.length === 0) {
    return []
  }

  // Create clusters based on city
  validObjects.forEach((obj) => {
    try {
      const sourceCity = obj.attributes.city_en || "Unknown"
      const targetCity = obj.attributes.institution_city_en || "Unknown"

      if (sourceCity === "Unknown" || targetCity === "Unknown" || sourceCity === targetCity) {
        return
      }

      const sourcePos: [number, number] = [obj.attributes.longitude, obj.attributes.latitude]
      const targetPos: [number, number] = [obj.attributes.institution_longitude, obj.attributes.institution_latitude]

      // Create a unique key for this city pair
      const key = `${sourceCity}-to-${targetCity}`

      if (cityClusters.has(key)) {
        // Add to existing cluster
        const cluster = cityClusters.get(key)!
        cluster.count++
        cluster.objects.push(obj)
      } else {
        // Create new cluster
        cityClusters.set(key, {
          id: key,
          sourcePosition: sourcePos,
          targetPosition: targetPos,
          count: 1,
          objects: [obj],
          level: "city",
        })
      }
    } catch (error) {
      console.error("Error processing object for city arc:", error, obj)
    }
  })

  // Convert map to array
  let cityArcs = Array.from(cityClusters.values())

  // If we have too many arcs, reduce them
  if (cityArcs.length > maxArcs) {
    cityArcs.sort((a, b) => b.count - a.count)
    cityArcs = cityArcs.slice(0, maxArcs)
  }

  return cityArcs
}

// Function to get arcs based on zoom level
export function getArcsByZoomLevel(
  objects: MuseumObject[] = [],
  zoom = 0,
  bounds?: { north: number; south: number; east: number; west: number },
): ClusteredArc[] {
  // Skip processing if no objects
  if (!objects || objects.length === 0) {
    return []
  }

  // Global view (zoom <= 4): Show only real arcs, no country-level aggregation
  if (zoom <= 4) {
    console.log("Using limited arcs for global view, zoom level:", zoom)
    // Just show a limited number of real arcs for global view
    return clusterArcs(objects, 100)
  }

  // City view (4 < zoom <= 8): Show city-level aggregation
  else if (zoom <= 8) {
    console.log("Using city-level aggregation for zoom level:", zoom)
    return clusterArcsByCity(objects, 500)
  }

  // Detailed view (zoom > 8): Show individual arcs
  else {
    console.log("Using detailed object arcs for zoom level:", zoom)

    // Filter objects by bounds if provided
    let objectsToProcess = objects
    if (bounds) {
      objectsToProcess = objects.filter(
        (obj) =>
          obj.attributes.latitude >= bounds.south &&
          obj.attributes.latitude <= bounds.north &&
          obj.attributes.longitude >= bounds.west &&
          obj.attributes.longitude <= bounds.east,
      )
    }

    // Adjust maxArcs based on zoom level
    const maxArcs = zoom >= 12 ? 2000 : 1000

    return clusterArcs(objectsToProcess, maxArcs)
  }
}

// Function to filter arcs by bounds
export function filterArcsByBounds(
  arcs: ClusteredArc[],
  bounds: { north: number; south: number; east: number; west: number },
  padding = 1, // Degrees of padding around the bounds
): ClusteredArc[] {
  if (!arcs || arcs.length === 0 || !bounds) {
    return arcs
  }

  // Add padding to bounds
  const paddedBounds = {
    north: bounds.north + padding,
    south: bounds.south - padding,
    east: bounds.east + padding,
    west: bounds.west - padding,
  }

  // Filter arcs that have either source or target within the padded bounds
  return arcs.filter((arc) => {
    const [sourceLng, sourceLat] = arc.sourcePosition
    const [targetLng, targetLat] = arc.targetPosition

    // Check if source is within bounds
    const sourceInBounds =
      sourceLat >= paddedBounds.south &&
      sourceLat <= paddedBounds.north &&
      sourceLng >= paddedBounds.west &&
      sourceLng <= paddedBounds.east

    // Check if target is within bounds
    const targetInBounds =
      targetLat >= paddedBounds.south &&
      targetLat <= paddedBounds.north &&
      targetLng >= paddedBounds.west &&
      targetLng <= paddedBounds.east

    // Include arc if either source or target is within bounds
    return sourceInBounds || targetInBounds
  })
}
