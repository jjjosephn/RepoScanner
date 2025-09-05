'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Key, 
  Package, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  FileText,
  Shield,
  Copy,
  CheckCircle
} from 'lucide-react'

interface SecretFinding {
  id: string
  type: string
  provider: string
  file: string
  line: number
  severity: 'high' | 'medium' | 'low'
  redactedValue: string
  description: string
  remediation: string
}

interface DependencyRisk {
  id: string
  package: string
  version: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  vulnerability: string
  cve?: string
  advisoryUrl?: string
  recommendedVersion: string
  description: string
}

interface ScanResultsProps {
  selectedRepository: string | null
}

export function ScanResults({ selectedRepository }: ScanResultsProps) {
  const [secrets, setSecrets] = useState<SecretFinding[]>([])
  const [dependencies, setDependencies] = useState<DependencyRisk[]>([])
  const [loading, setLoading] = useState(false)
  const [showRedacted, setShowRedacted] = useState(true)

  useEffect(() => {
    if (selectedRepository) {
      fetchScanResults()
    }
  }, [selectedRepository])

  const fetchScanResults = async () => {
    if (!selectedRepository) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/scan/results/${selectedRepository}`)
      if (response.ok) {
        const data = await response.json()
        setSecrets(data.secrets || [])
        setDependencies(data.dependencies || [])
      }
    } catch (error) {
      console.error('Failed to fetch scan results:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'destructive'
      case 'medium':
        return 'warning'
      default:
        return 'secondary'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (!selectedRepository) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Select a repository from the list to view security findings
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading scan results...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Security Findings</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRedacted(!showRedacted)}
          >
            {showRedacted ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showRedacted ? 'Hide' : 'Show'} Redacted Values
          </Button>
        </div>
      </div>

      <Tabs defaultValue="secrets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="secrets" className="flex items-center space-x-2">
            <Key className="h-4 w-4" />
            <span>Secrets ({secrets.length})</span>
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="flex items-center space-x-2">
            <Package className="h-4 w-4" />
            <span>Dependencies ({dependencies.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="secrets" className="space-y-4">
          {secrets.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No exposed secrets found in this repository
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {secrets.map((secret) => (
                <Card key={secret.id} className="border-l-4 border-l-red-500">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <Key className="h-5 w-5 text-red-500" />
                          <span>{secret.provider} {secret.type}</span>
                          <Badge variant={getSeverityColor(secret.severity)}>
                            {secret.severity.toUpperCase()}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center space-x-2 mt-1">
                          <FileText className="h-4 w-4" />
                          <span>{secret.file}:{secret.line}</span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{secret.description}</p>
                      
                      {showRedacted && (
                        <div className="bg-muted p-3 rounded-md">
                          <div className="flex items-center justify-between">
                            <code className="text-sm font-mono">{secret.redactedValue}</code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(secret.redactedValue)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
                        <h4 className="font-semibold text-sm mb-2 flex items-center">
                          <Shield className="h-4 w-4 mr-2 text-blue-500" />
                          Remediation
                        </h4>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          {secret.remediation}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          {dependencies.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No vulnerable dependencies found in this repository
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {dependencies.map((dep) => (
                <Card key={dep.id} className="border-l-4 border-l-orange-500">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center space-x-2">
                          <Package className="h-5 w-5 text-orange-500" />
                          <span>{dep.package}</span>
                          <Badge variant="outline">{dep.version}</Badge>
                          <Badge variant={getSeverityColor(dep.riskLevel)}>
                            {dep.riskLevel.toUpperCase()}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {dep.vulnerability}
                          {dep.cve && (
                            <span className="ml-2 font-mono text-xs">({dep.cve})</span>
                          )}
                        </CardDescription>
                      </div>
                      {dep.advisoryUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(dep.advisoryUrl, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Advisory
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{dep.description}</p>
                      
                      <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md">
                        <h4 className="font-semibold text-sm mb-2 flex items-center">
                          <Shield className="h-4 w-4 mr-2 text-green-500" />
                          Recommended Action
                        </h4>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          Update to version <code className="font-mono bg-green-100 dark:bg-green-900 px-1 rounded">
                            {dep.recommendedVersion}
                          </code> or later
                        </p>
                        <div className="mt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(`npm update ${dep.package}@${dep.recommendedVersion}`)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Update Command
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
