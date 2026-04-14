import type { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'

if (process.env.NODE_ENV === 'development') {
  const u = process.env.NEXTAUTH_URL ?? ''
  if (!u) {
    console.warn(
      '[next-auth] NEXTAUTH_URL is unset. Add it to .env.local (e.g. http://localhost:3000) so GitHub OAuth returns to the correct origin.'
    )
  } else if (/:3001(\/|$)/.test(u)) {
    console.warn(
      '[next-auth] NEXTAUTH_URL uses port 3001. If you open the app on :3000, sign-in will fail — set NEXTAUTH_URL to match the browser URL and update the GitHub OAuth callback URL to the same origin.'
    )
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'read:user user:email repo'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      return session
    }
  },
  pages: {
    signIn: '/'
  }
}
