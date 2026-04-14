/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  // Use .env.local for NEXTAUTH_*, GITHUB_*, BACKEND_URL (server-only). Do not put secrets in `env`
  // here — that inlines values into the browser bundle. The UI only talks to this app on :3000;
  // Route Handlers proxy to BACKEND_URL (Python) on :8000.
}

module.exports = nextConfig
