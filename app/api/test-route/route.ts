import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Test route is working',
    timestamp: new Date().toISOString()
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    return NextResponse.json({
      message: 'Test POST route is working',
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to parse JSON body',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 400 })
  }
} 