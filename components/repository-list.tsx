'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Github, 
  Scan, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock,
  ExternalLink 
} from 'lucide-react'

interface Repository {
  id: string
  name: string
  fullName: string
  description: string
  url: string
  private: boolean
  lastScanned: string | null
  scanStatus: 'clean' | 'issues' | 'scanning' | 'never'
  secretsCount: number
  dependencyRisks: number
  language: string
  updatedAt: string
}

interface RepositoryListProps {
  repositories: Repository[]
  onSelectRepository: (repoId: string) => void
  onScanRepository: (repoId: string) => void
  isScanning: boolean
}

export function RepositoryList({ 
  repositories, 
  onSelectRepository, 
  onScanRepository, 
  isScanning 
}: RepositoryListProps) {
  const [filter, setFilter] = useState<'all' | 'clean' | 'issues' | 'never'>('all')

  const filteredRepositories = repositories.filter(repo => {
    if (filter === 'all') return true
    return repo.scanStatus === filter
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'clean':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'issues':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'scanning':
        return <Scan className="h-4 w-4 text-blue-500 animate-pulse" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (repo: Repository) => {
    if (repo.scanStatus === 'clean') {
      return <Badge variant="success">Clean</Badge>
    }
    if (repo.scanStatus === 'issues') {
      return (
        <Badge variant="destructive">
          {repo.secretsCount + repo.dependencyRisks} Issues
        </Badge>
      )
    }
    if (repo.scanStatus === 'scanning') {
      return <Badge variant="secondary">Scanning...</Badge>
    }
    return <Badge variant="secondary">Not Scanned</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Repositories</h2>
        <div className="flex space-x-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="bg-blue-800"
            onClick={() => setFilter('all')}
          >
            All ({repositories.length})
          </Button>
          <Button
            variant={filter === 'clean' ? 'default' : 'outline'}
            size="sm"
            className="bg-blue-200"
            onClick={() => setFilter('clean')}
          >
            Clean ({repositories.filter(r => r.scanStatus === 'clean').length})
          </Button>
          <Button
            variant={filter === 'issues' ? 'default' : 'outline'}
            size="sm"
            className="bg-blue-200"
            onClick={() => setFilter('issues')}
          >
            Issues ({repositories.filter(r => r.scanStatus === 'issues').length})
          </Button>
          <Button
            variant={filter === 'never' ? 'default' : 'outline'}
            size="sm"
            className="bg-blue-200"
            onClick={() => setFilter('never')}
          >
            Not Scanned ({repositories.filter(r => r.scanStatus === 'never').length})
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRepositories.map((repo) => (
          <Card key={repo.id} className="hover:shadow-md transition-shadow border border-white/20 bg-white/15 backdrop-blur-xl shadow-l">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Github className="h-5 w-5 text-black" />
                  <div>
                    <CardTitle className="text-lg text-white">{repo.name}</CardTitle>
                    <CardDescription className="flex items-center space-x-2 text-blue-100">
                      <span>{repo.fullName}</span>
                      {repo.private && (
                        <Badge variant="outline" className="text-x text-white">Private</Badge>
                      )}
                      {repo.language && (
                        <Badge variant="secondary" className="text-xs">{repo.language}</Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(repo.scanStatus)}
                  {getStatusBadge(repo)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {repo.description && (
                    <p className="text-sm text-blue-100 mb-2">
                      {repo.description}
                    </p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-blue-100">
                    {repo.lastScanned && (
                      <span>Last scanned: {new Date(repo.lastScanned).toLocaleDateString()}</span>
                    )}
                    <span>Updated: {new Date(repo.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {repo.scanStatus === 'issues' && (
                    <div className="flex space-x-4 mt-2 text-sm">
                      {repo.secretsCount > 0 && (
                        <span className="text-red-600">
                          {repo.secretsCount} secret{repo.secretsCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {repo.dependencyRisks > 0 && (
                        <span className="text-orange-600">
                          {repo.dependencyRisks} dependency risk{repo.dependencyRisks !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-800"        
                    onClick={() => {
                      console.log('Repository object:', repo)
                      console.log('Repository ID:', repo.id)
                      onSelectRepository(repo.id)
                    }}
                  >
                    View Details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-800"
                    onClick={() => onScanRepository(repo.id)}
                    disabled={isScanning || repo.scanStatus === 'scanning'}
                  >
                    <Scan className="h-4 w-4 mr-1" />
                    Scan
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(repo.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRepositories.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Github className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {filter === 'all' 
                ? 'No repositories found. Make sure you have access to GitHub repositories.'
                : `No repositories with status "${filter}" found.`
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
