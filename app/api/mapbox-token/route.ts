import { NextResponse } from "next/server"

export async function GET() {
  const token = process.env.MAPBOX_TOKEN

  if (!token) {
    return NextResponse.json({ error: "Mapbox token not configured" }, { status: 500 })
  }

  return NextResponse.json({ token })
}
