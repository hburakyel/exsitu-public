import { NextResponse } from "next/server"

// Track webhook calls
interface WebhookTracker {
  lastCall: number
  callCount: number
}

const webhookTracker: WebhookTracker = {
  lastCall: 0,
  callCount: 0,
}

// Export function to update webhook tracker (to be called from webhook route)
export function trackWebhookCall() {
  webhookTracker.lastCall = Date.now()
  webhookTracker.callCount++
}

export async function GET() {
  // Get all cache information
  const cacheInfo = {
    webhook: {
      lastCall: webhookTracker.lastCall ? new Date(webhookTracker.lastCall).toISOString() : "Never",
      callCount: webhookTracker.callCount,
      timeSinceLastCall: webhookTracker.lastCall
        ? `${Math.floor((Date.now() - webhookTracker.lastCall) / 1000)} seconds`
        : "N/A",
    },
    // Add more cache information as needed
    serverTime: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV || "Not set",
    },
  }

  return NextResponse.json(cacheInfo)
}
