import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Never cache — progress must reflect live Python scan state (Next fetch cache breaks polling).
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get scan status from Python backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    const response = await fetch(`${backendUrl}/api/scan/status`, {
      cache: 'no-store',
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch scan status')
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching scan status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scan status' },
      { status: 500 }
    )
  }
}
