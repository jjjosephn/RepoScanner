# RepoScanner Setup Guide

## Quick Start Instructions

### 1. Install Frontend Dependencies

**Option A: Install all at once (if npm install works):**
```bash
cd reposcanner
npm install
```

**Option B: Install step by step (if you encounter dependency errors):**
```bash
cd reposcanner
npm install next@14.0.0 react@18.2.0 react-dom@18.2.0
npm install next-auth@4.24.0 axios@1.6.0
npm install @radix-ui/react-slot@1.0.2 @radix-ui/react-progress@1.0.3 @radix-ui/react-tabs@1.0.4 @radix-ui/react-icons@1.3.0
npm install class-variance-authority@0.7.0 clsx@2.0.0 lucide-react@0.290.0 recharts@2.8.0 tailwind-merge@2.0.0 tailwindcss-animate@1.0.7
npm install -D typescript@5.0.0 @types/node@20.0.0 @types/react@18.2.0 @types/react-dom@18.2.0
npm install -D autoprefixer@10.4.0 eslint@8.0.0 eslint-config-next@14.0.0 postcss@8.4.0 tailwindcss@3.3.0
```

### 2. Setup Environment Variables

Create `.env.local` file in the root directory:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-here
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
BACKEND_URL=http://localhost:8000
```

### 3. Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: RepoScanner
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Copy the Client ID and Client Secret to your `.env.local` file

### 4. Setup Python Backend

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 5. Run the Application

**Terminal 1 - Start Backend:**
```bash
cd backend
python main.py
```

**Terminal 2 - Start Frontend:**
```bash
npm run dev
```

### 6. Access the Application

Open your browser and go to: `http://localhost:3000`

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**: Run `npm install` to install all dependencies
2. **GitHub OAuth errors**: Verify your Client ID and Secret are correct
3. **Backend connection errors**: Ensure the Python backend is running on port 8000
4. **Permission errors**: Make sure your GitHub token has `repo` scope access

### Port Configuration

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

If you need to change ports, update the `BACKEND_URL` in your `.env.local` file.

## Next Steps

1. Sign in with your GitHub account
2. Grant repository access permissions
3. Click "Rescan All Repositories" to start your first security scan
4. Review the findings in the dashboard

## Security Note

This application requires read access to your repositories to scan for secrets and vulnerabilities. All scanning is performed locally and no sensitive data is stored or transmitted to external services.
