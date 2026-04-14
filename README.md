# RepoScanner - GitHub Repository Security Scanner

A comprehensive web application that helps developers secure their GitHub repositories by detecting exposed secrets and analyzing dependency risks.

## Features

### 🔐 Secrets Detection
- **Advanced Pattern Matching**: Detects AWS keys, Google Cloud API keys, GitHub tokens, Stripe keys, OpenAI API keys, and more
- **Entropy Analysis**: Uses Shannon entropy to identify high-entropy strings that may be secrets
- **Privacy First**: All sensitive data is redacted - only partial key fragments are displayed
- **Comprehensive Coverage**: Scans for 15+ types of credentials and tokens

### 📦 Dependency Risk Analysis
- **Vulnerability Detection**: Identifies packages with known CVEs
- **Supply Chain Protection**: Flags compromised packages from recent attacks (eslint-config-prettier, synckit, @pkgr/core)
- **Remediation Guidance**: Provides specific version recommendations and update commands
- **Lock File Analysis**: Supports package.json, package-lock.json, and yarn.lock

### 🎯 User-Friendly Dashboard
- **Overview Summary**: Total repositories, secrets found, dependency risks, security score
- **Repository Management**: Clean/issues status badges, selective scanning
- **Detailed Findings**: Expandable results with file paths, line numbers, and remediation advice
- **Data Visualization**: Risk distribution charts and security trends
- **Interactive Controls**: Rescan repositories, refresh data, view external advisories

## Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **shadcn/ui** for modern UI components
- **Recharts** for data visualization
- **NextAuth.js** for GitHub OAuth

### Backend
- **FastAPI** (Python) for high-performance API
- **GitHub API** integration for repository access
- **Async processing** for concurrent scanning
- **PostgreSQL** (optional via `DATABASE_URL` + SQLAlchemy/asyncpg); otherwise in-memory scan state

## Theming

- **Design tokens** live in `app/globals.css` as HSL components under `[data-theme="dark"]` and `[data-theme="light"]` (e.g. `--background`, `--primary`, `--radius-lg`, `--shadow-card`).
- **Tailwind** maps those variables in `tailwind.config.js` (`colors`, `boxShadow`, `fontFamily`, etc.).
- The root **`app/layout.tsx`** runs an inline script so `document.documentElement` gets `data-theme` from `localStorage` (`reposcanner-theme`) before paint, defaulting to **dark**. Use **`components/theme-toggle.tsx`** on the marketing page and dashboard to switch themes.

## Marketing live demo (static)

The signed-out landing page includes a **Live demo** section that **does not** call the scan API or GitHub OAuth.

- **Sample payloads:** `lib/demo-data.ts` (repositories, redacted secret fragments, fake CVE-style dependency rows, remediation copy).
- **UI + scripted animation:** `components/marketing-live-demo.tsx` (progress bar, staggered stats/repos, then findings). Secret and dependency cards mount one at a time with a **slide-in / fade** entrance (`findingCardEnter`); timing knobs live in `DEMO_MS` (`findingCardStagger`, `afterSecretsToDeps`). If the user has **`prefers-reduced-motion: reduce`**, the demo jumps straight to the final state.
- **Shared dashboard visuals:** summary stat cards use **`components/summary-stat-cards.tsx`**, the same component as the signed-in dashboard.

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.8+
- GitHub OAuth App (for authentication)

### 1. Clone and Setup Frontend

```bash
git clone <repository-url>
cd reposcanner

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### 2. Configure GitHub OAuth

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create a new OAuth App with:
   - Application name: `RepoScanner`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Copy Client ID and Client Secret to `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
BACKEND_URL=http://localhost:8000
```

### 3. Setup Python Backend
# FOR MAC USERS!
# If python command is not found use python3!!!
# EXAMPLE: python3 -m venv venv
# if you get a failed building wheel error ignore it. app should still work
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

#### PostgreSQL (optional)

Without `DATABASE_URL`, scan progress and results live in process memory only. To persist scans across restarts:

1. From the repo root: `docker compose up -d postgres` (see `docker-compose.yml`).
2. Add to `backend/.env` (the backend loads `.env` from the current working directory):

   `DATABASE_URL=postgresql+asyncpg://reposcanner:reposcanner@localhost:5432/reposcanner`

3. Start the backend as usual; tables are created on startup. For production, use a managed database and TLS.

**CORS:** set `FRONTEND_ORIGINS` to a comma-separated list if the Next.js app is not only on `http://localhost:3000`.

### 4. Run the Application
# FOR MAC USERS!
# python3 main.py
# MIGHT GET DEPENDENCY ERRORS:
# IF YOU GET FASTAPI missing
# chances are you are missing httpx and uvicorn so do this!!!
```bash
pip install fastapi
pip install httpx
pip install uvicorn
```
**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Visit `http://localhost:3000` and sign in with GitHub!

## Usage Guide

### Initial Setup
1. **Sign in** with your GitHub account
2. **Grant permissions** for repository access
3. **Click "Rescan All Repositories"** to start your first scan

### Understanding Results

#### Secrets Detection
- **High Severity**: API keys, private keys, live credentials
- **Medium Severity**: Test keys, JWT tokens, high-entropy strings
- **Low Severity**: Potential secrets requiring manual review

#### Dependency Risks
- **Critical**: Compromised packages with known malware
- **High**: Packages with severe security vulnerabilities
- **Medium**: Packages with moderate security issues
- **Low**: Outdated packages with minor issues

### Best Practices
1. **Regular Scanning**: Run scans weekly or after major changes
2. **Immediate Action**: Address critical and high-severity findings first
3. **Environment Variables**: Use `.env` files for all secrets
4. **Dependency Updates**: Keep packages updated to latest secure versions
5. **Code Review**: Implement pre-commit hooks for secret detection

## Security Features

### Privacy Protection
- **Minimal retention**: Findings are analyzed in memory; with PostgreSQL enabled, redacted metadata and dependency rows may be stored until you delete them
- **Redaction**: Only partial key fragments shown (e.g., `AKIA****1234`)
- **Local Processing**: All analysis happens on your infrastructure
- **Secure Transit**: HTTPS encryption for all API communications

### Access Control
- **OAuth Integration**: Secure GitHub authentication
- **Token Scoping**: Minimal required permissions (read-only repository access)
- **Session Management**: Secure session handling with NextAuth.js

## API Reference

### Scan Endpoints

#### Start Scan
```http
POST /api/scan
Content-Type: application/json
Authorization: Bearer <github-token>

{
  "repositoryIds": ["123456789"] // Optional: specific repos
}
```

#### Get Scan Status
```http
GET /api/scan/status
Authorization: Bearer <github-token>
```

#### Get Scan Results
```http
GET /api/scan/results/{repositoryId}
Authorization: Bearer <github-token>
```

### Repository Endpoints

#### List Repositories
```http
GET /api/repositories
Authorization: Bearer <github-token>
```

## Development

### Project Structure
```
reposcanner/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── dashboard.tsx     # Main dashboard
│   ├── repository-list.tsx
│   ├── scan-results.tsx
│   └── risk-chart.tsx
├── backend/              # Python FastAPI backend
│   ├── scanner/          # Scanning modules
│   │   ├── secrets_detector.py
│   │   ├── dependency_analyzer.py
│   │   └── github_client.py
│   ├── main.py          # FastAPI application
│   └── requirements.txt
└── lib/                 # Utility functions
```

### Adding New Secret Patterns

Edit `backend/scanner/secrets_detector.py`:

```python
"new_service_key": {
    "pattern": r"your-regex-pattern",
    "provider": "Service Name",
    "type": "API Key",
    "severity": "high",
    "description": "Description of the secret type",
    "remediation": "How to fix this issue"
}
```

### Adding Vulnerability Data

Edit `backend/scanner/dependency_analyzer.py`:

```python
"package-name": {
    "vulnerable_versions": ["<1.0.0"],
    "cve": "CVE-2023-XXXX",
    "description": "Vulnerability description",
    "risk_level": "high",
    "recommended_version": "1.0.0",
    "advisory_url": "https://github.com/advisories/..."
}
```

## Deployment

### Frontend (Vercel/Netlify)
1. Connect your Git repository
2. Set environment variables
3. Deploy with build command: `npm run build`

### Backend (Railway/Heroku/Docker)
1. Create `Dockerfile` in backend directory
2. Set environment variables
3. Deploy with Python runtime

### Database Integration
For production, replace in-memory storage with:
- **PostgreSQL** for scan results
- **Redis** for session management
- **MongoDB** for flexible document storage

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Issues**: GitHub Issues for bug reports and feature requests
- **Security**: Report security vulnerabilities privately
- **Documentation**: Check the `/docs` folder for detailed guides

## Roadmap

- [ ] Database integration for persistent storage
- [ ] Slack/Discord notifications for critical findings
- [ ] CI/CD integration (GitHub Actions, GitLab CI)
- [ ] Custom rule engine for organization-specific patterns
- [ ] SARIF export for integration with security tools
- [ ] Multi-language support (Python, Java, Go repositories)
- [ ] Historical trend analysis and reporting
- [ ] Team collaboration features

---

**Made with ❤️ for developer security**
