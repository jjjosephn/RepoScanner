'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface Repository {
  id: string
  name: string
  scanStatus: string
  secretsCount: number
  dependencyRisks: number
}

interface RiskChartProps {
  repositories: Repository[]
}

export function RiskChart({ repositories }: RiskChartProps) {
  // Prepare data for risk distribution chart
  const riskData = [
    {
      name: 'Clean',
      count: repositories.filter(r => r.scanStatus === 'clean').length,
      color: '#10b981'
    },
    {
      name: 'Secrets Found',
      count: repositories.filter(r => r.secretsCount > 0).length,
      color: '#ef4444'
    },
    {
      name: 'Dependency Risks',
      count: repositories.filter(r => r.dependencyRisks > 0).length,
      color: '#f59e0b'
    },
    {
      name: 'Not Scanned',
      count: repositories.filter(r => r.scanStatus === 'never').length,
      color: '#6b7280'
    }
  ]

  // Prepare data for severity distribution
  const severityData = repositories
    .filter(r => r.scanStatus === 'issues')
    .map(r => ({
      name: r.name.length > 15 ? r.name.substring(0, 15) + '...' : r.name,
      secrets: r.secretsCount,
      dependencies: r.dependencyRisks,
      total: r.secretsCount + r.dependencyRisks
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10) // Top 10 repositories with issues

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6b7280']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Risk Distribution</CardTitle>
          <CardDescription>
            Overview of security status across all repositories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, count, percent }) => 
                  `${name}: ${count} (${(percent * 100).toFixed(0)}%)`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Repositories by Issues</CardTitle>
          <CardDescription>
            Repositories with the most security findings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={severityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="secrets" stackId="a" fill="#ef4444" name="Secrets" />
                <Bar dataKey="dependencies" stackId="a" fill="#f59e0b" name="Dependencies" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No security issues found across repositories
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
