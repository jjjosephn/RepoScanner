'use client'

import { useSession, signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Github, Scan, AlertTriangle } from 'lucide-react'
import { Dashboard } from '@/components/dashboard' 

export default function Home() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background bg-gradient-to-br from-blue-400 via-purple-400 to-gray-600">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-16">
            <img
              src="/app/reposent.png"
              alt="Repo Sentinel"
              className="mx-auto mb-4 text-4xl font-bold"
            />
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Secure your GitHub repositories by detecting exposed secrets and analyzing dependency risks
            </p>
            <Button 
              onClick={() => signIn('github')} 
              size="lg" 
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              <Github className="mr-2 h-5 w-5" />
              Sign in with GitHub
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Scan className="mr-2 h-5 w-5 text-blue-500" />
                  Secrets Detection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Automatically scan repositories for exposed API keys, tokens, and credentials using advanced pattern matching and entropy analysis.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5 text-orange-500" />
                  Dependency Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Identify vulnerable dependencies and compromised packages in your package.json and lock files with detailed remediation guidance.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-green-500" />
                  Privacy First
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  All sensitive data is redacted and never stored. Only partial key fragments are displayed to maintain your security.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return <Dashboard />
}
