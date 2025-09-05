import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch repositories from GitHub API
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch repositories')
    }

    const repos = await response.json()
    
    // Get scan results from backend to populate repository status
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    let scanResults: Record<string, any> = {}
    
    try {
      const scanResponse = await fetch(`${backendUrl}/scan/results`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        },
      })
      
      if (scanResponse.ok) {
        const scanData = await scanResponse.json()
        scanResults = scanData.results || {}
      }
    } catch (error) {
      console.log('Could not fetch scan results:', error)
    }
    
    // Transform GitHub API response to our format with scan status
    const repositories = repos.map((repo: any) => {
      const repoId = repo.id.toString()
      const scanResult = scanResults[repoId]
      
      let scanStatus = 'never'
      let secretsCount = 0
      let dependencyRisks = 0
      let lastScanned = null
      
      if (scanResult) {
        secretsCount = scanResult.secrets?.length || 0
        dependencyRisks = scanResult.dependencies?.length || 0
        lastScanned = scanResult.scannedAt || null
        
        if (secretsCount > 0 || dependencyRisks > 0) {
          scanStatus = 'issues'
        } else {
          scanStatus = 'clean'
        }
      }
      
      return {
        id: repoId,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        private: repo.private,
        language: repo.language,
        updatedAt: repo.updated_at,
        lastScanned,
        scanStatus,
        secretsCount,
        dependencyRisks,
      }
    })

    return NextResponse.json({ repositories })
  } catch (error) {
    console.error('Error fetching repositories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    )
  }
}
