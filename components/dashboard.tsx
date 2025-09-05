'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  Github, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  EyeOff,
  ExternalLink,
  Package,
  Key,
  FileText,
  BarChart3,
  X
} from 'lucide-react'
import { RepositoryList } from '@/components/repository-list'
import { ScanResults } from '@/components/scan-results'
import { RiskChart } from '@/components/risk-chart'

interface ScanSummary {
  totalRepositories: number
  repositoriesScanned: number
  secretsFound: number
  dependencyRisks: number
  isScanning: boolean
  scanProgress: number
  scanningRepositoryCount: number
}

export function Dashboard() {
  const { data: session } = useSession()
  const [summary, setSummary] = useState<ScanSummary>({
    totalRepositories: 0,
    repositoriesScanned: 0,
    secretsFound: 0,
    dependencyRisks: 0,
    isScanning: false,
    scanProgress: 0,
    scanningRepositoryCount: 0
  })

  const [repositories, setRepositories] = useState([])
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('repositories')

  useEffect(() => {
    fetchRepositories()
  }, [])

  const fetchRepositories = async () => {
    try {
      const response = await fetch('/api/repositories')
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched repositories:', data.repositories)
        setRepositories(data.repositories)
        setSummary(prev => ({
          ...prev,
          totalRepositories: data.repositories.length
        }))
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error)
    }
  }

  const startScan = async (repoIds?: string[]) => {
    console.log('startScan called with repoIds:', repoIds)
    console.log('repoIds type:', typeof repoIds)
    console.log('repoIds is array:', Array.isArray(repoIds))
    console.log('repoIds length:', repoIds?.length)
    
    setSummary(prev => ({ ...prev, isScanning: true, scanProgress: 0 }))
    
    try {
      const requestBody = { repositoryIds: repoIds }
      console.log('Sending request body:', JSON.stringify(requestBody, null, 2))
      
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      if (response.ok) {
        // Poll for scan progress
        pollScanProgress()
      }
    } catch (error) {
      console.error('Failed to start scan:', error)
      setSummary(prev => ({ ...prev, isScanning: false }))
    }
  }

  const cancelScan = async () => {
    try {
      const response = await fetch('/api/scan/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        setSummary(prev => ({ ...prev, isScanning: false }))
        fetchRepositories() // Refresh to show updated statuses
      }
    } catch (error) {
      console.error('Failed to cancel scan:', error)
    }
  }

  const pollScanProgress = async () => {
    let pollCount = 0
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/scan/status')
        if (response.ok) {
          const data = await response.json()
          const prevScannedCount = summary.repositoriesScanned
          
          setSummary(prev => ({
            ...prev,
            scanProgress: data.progress,
            repositoriesScanned: data.scannedCount,
            secretsFound: data.secretsFound,
            dependencyRisks: data.dependencyRisks,
            scanningRepositoryCount: data.totalRepositories || prev.scanningRepositoryCount
          }))
          
          // Only refresh repository data when scan is completed
          // For single repo scans, we don't need to refresh during the process
          if (data.completed) {
            setSummary(prev => ({ ...prev, isScanning: false }))
            clearInterval(interval)
            fetchRepositories() // Final refresh when scan is complete
          }
          
          pollCount++
        }
      } catch (error) {
        console.error('Failed to fetch scan status:', error)
      }
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-background bg-gradient-to-br from-blue-400 via-purple-400 to-gray-600">
      {/* Header CHANGE */}
      <header className=""> 
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl text-white">RepoSentinel</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img 
                src={session?.user?.image || ''} 
                alt="Profile" 
                className="w-8 h-8 rounded-full"
              />
              <span className="text-sm font-medium text-white">{session?.user?.name}</span>
            </div>
            <Button variant="ghost" className="text-white" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Repositories</CardTitle>
              <Github className="h-4 w-4 text-black" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-50">{summary.totalRepositories}</div>
              <p className="text-xs text-blue-50">
                {summary.repositoriesScanned} scanned
              </p>
            </CardContent>
          </Card>

          <Card className="border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Secrets Found</CardTitle>
              <Key className="h-4 w-4 text-blue-100" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.secretsFound}</div>
              <p className="text-xs text-muted-foreground text-blue-100">
                Exposed credentials detected
              </p>
            </CardContent>
          </Card>

          <Card className="border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Dependency Risks</CardTitle>
              <Package className="h-4 w-4 text-blue-100" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary.dependencyRisks}</div>
              <p className="text-xs text-blue-100">
                Vulnerable packages found
              </p>
            </CardContent>
          </Card>

          <Card className="border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-100">Security Score</CardTitle>
              <BarChart3 className="h-4 w-4 text-white" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {summary.totalRepositories > 0 
                  ? Math.max(0, 100 - ((summary.secretsFound + summary.dependencyRisks) / summary.totalRepositories) * 20)
                    .toFixed(0)
                  : 100}%
              </div>
              <p className="text-xs text-blue-100">
                Overall security rating
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scan Progress */}
        {summary.isScanning && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                Scanning Repositories...
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={summary.scanProgress} className="mb-2" />
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {summary.scanProgress}% complete - Analyzing {summary.repositoriesScanned} of {summary.scanningRepositoryCount > 0 ? summary.scanningRepositoryCount : summary.totalRepositories} repositories
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={cancelScan}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="mr-1 h-3 w-3" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4 mb-8">
          <Button
            onClick={() => startScan()} 
            disabled={summary.isScanning}
            className="bg-blue-800 hover:bg-primary/90 "
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${summary.isScanning ? 'animate-spin' : ''}`} />
            {summary.isScanning ? 'Scanning...' : 'Rescan All Repositories'}
          </Button>
          <Button variant="outline" onClick={fetchRepositories}>
            <Github className="mr-2 h-4 w-4" />
            Refresh Repository List
          </Button>
        </div>

        {/* Main Content Tabs */}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-blue-200">
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="findings">Security Findings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="repositories" className="space-y-4">
            <RepositoryList 
              repositories={repositories}
              onSelectRepository={(repoId) => {
                console.log('Selected repository ID:', repoId)
                if (repoId && repoId !== 'undefined') {
                  setSelectedRepo(repoId)
                  setActiveTab('findings')
                }
              }}
              onScanRepository={(repoId) => startScan([repoId])}
              isScanning={summary.isScanning}
            />
          </TabsContent>

          <TabsContent value="findings" className="space-y-4">
            <ScanResults selectedRepository={selectedRepo} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RiskChart repositories={repositories} />
              <Card>
                <CardHeader>
                  <CardTitle>Security Trends</CardTitle>
                  <CardDescription>
                    Track security improvements over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-muted-foreground py-8">
                    Security trend data will appear after multiple scans
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
