from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import httpx
import asyncio
import json
import os
from datetime import datetime
import uuid

from scanner.secrets_detector import SecretsDetector
from scanner.dependency_analyzer import DependencyAnalyzer
from scanner.github_client import GitHubClient

app = FastAPI(title="RepoScanner Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# In-memory storage for scan results (in production, use a database)
scan_sessions: Dict[str, Dict] = {}
scan_results: Dict[str, Dict] = {}

class ScanRequest(BaseModel):
    repositoryIds: Optional[List[str]] = None
    githubToken: str

class ScanStatus(BaseModel):
    progress: int
    completed: bool
    scannedCount: int
    secretsFound: int
    dependencyRisks: int

async def verify_github_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify GitHub token and return user info"""
    token = credentials.credentials
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        
        return {"token": token, "user": response.json()}

@app.post("/api/scan")
async def start_scan(
    scan_request: ScanRequest,
    background_tasks: BackgroundTasks,
    auth_data: dict = Depends(verify_github_token)
):
    """Start repository scanning process"""
    session_id = str(uuid.uuid4())
    
    # Initialize scan session
    scan_sessions[session_id] = {
        "id": session_id,
        "user_id": auth_data["user"]["id"],
        "progress": 0,
        "completed": False,
        "scannedCount": 0,
        "secretsFound": 0,
        "dependencyRisks": 0,
        "startTime": datetime.utcnow().isoformat(),
        "repositoryIds": scan_request.repositoryIds
    }
    
    # Start background scanning
    background_tasks.add_task(
        perform_scan,
        session_id,
        scan_request.githubToken,
        scan_request.repositoryIds
    )
    
    return {"sessionId": session_id, "status": "started"}

@app.get("/api/scan/status")
async def get_scan_status(auth_data: dict = Depends(verify_github_token)):
    """Get current scan status for the user"""
    user_id = auth_data["user"]["id"]
    
    # Find the latest scan session for this user
    user_sessions = [
        session for session in scan_sessions.values()
        if session["user_id"] == user_id
    ]
    
    if not user_sessions:
        return ScanStatus(
            progress=0,
            completed=True,
            scannedCount=0,
            secretsFound=0,
            dependencyRisks=0
        )
    
    latest_session = max(user_sessions, key=lambda x: x["startTime"])
    
    return ScanStatus(
        progress=latest_session["progress"],
        completed=latest_session["completed"],
        scannedCount=latest_session["scannedCount"],
        secretsFound=latest_session["secretsFound"],
        dependencyRisks=latest_session["dependencyRisks"]
    )

@app.get("/scan/results")
async def get_all_scan_results(auth_data: dict = Depends(verify_github_token)):
    """Get all scan results for the user"""
    user_id = auth_data["user"]["id"]
    
    # Filter results for this user
    user_results = {}
    for key, result in scan_results.items():
        if key.startswith(f"{user_id}_"):
            repo_id = key.split("_", 1)[1]  # Remove user_id prefix
            user_results[repo_id] = result
    
    return {"results": user_results}

@app.get("/api/scan/results/{repository_id}")
async def get_scan_results(
    repository_id: str,
    auth_data: dict = Depends(verify_github_token)
):
    """Get scan results for a specific repository"""
    user_id = auth_data["user"]["id"]
    result_key = f"{user_id}_{repository_id}"
    
    if result_key not in scan_results:
        return {"secrets": [], "dependencies": []}
    
    return scan_results[result_key]

async def perform_scan(session_id: str, github_token: str, repository_ids: Optional[List[str]]):
    """Background task to perform repository scanning with parallel processing"""
    try:
        session = scan_sessions[session_id]
        github_client = GitHubClient(github_token)
        secrets_detector = SecretsDetector()
        dependency_analyzer = DependencyAnalyzer()
        
        # Get repositories to scan
        if repository_ids:
            repositories = await github_client.get_repositories_by_ids(repository_ids)
        else:
            repositories = await github_client.get_all_repositories()
        
        total_repos = len(repositories)
        session["progress"] = 0
        session["scannedCount"] = 0
        session["secretsFound"] = 0
        session["dependencyRisks"] = 0
        
        # Process repositories sequentially to avoid overwhelming GitHub API
        for i, repo in enumerate(repositories):
            try:
                # Update progress
                current_progress = int((i / total_repos) * 100)
                session["progress"] = current_progress
                
                print(f"Scanning repository {i+1}/{total_repos}: {repo.get('name', 'unknown')}")
                
                # Scan repository
                repo_results = await scan_repository(
                    repo, github_client, secrets_detector, dependency_analyzer
                )
                
                # Store results with timestamp
                result_key = f"{session['user_id']}_{repo['id']}"
                scan_results[result_key] = {
                    **repo_results,
                    "scannedAt": datetime.utcnow().isoformat()
                }
                
                # Update counters
                session["scannedCount"] += 1
                session["secretsFound"] += len(repo_results["secrets"])
                session["dependencyRisks"] += len(repo_results["dependencies"])
                
                # Update progress
                current_progress = min(100, int(((i + 1) / total_repos) * 100))
                session["progress"] = current_progress
                
                print(f"Completed {session['scannedCount']}/{total_repos} repositories ({current_progress}%)")
                
                # Add small delay to avoid rate limiting
                await asyncio.sleep(0.5)
                
            except Exception as e:
                print(f"Error scanning repository {repo.get('name', 'unknown')}: {e}")
                continue
        
        # Mark as completed
        session["progress"] = 100
        session["completed"] = True
        session["endTime"] = datetime.utcnow().isoformat()
        
    except asyncio.CancelledError:
        print(f"Scan session {session_id} was cancelled")
        session["completed"] = True
        session["error"] = "Scan was cancelled"
    except Exception as e:
        print(f"Error in scan session {session_id}: {e}")
        session["completed"] = True
        session["error"] = str(e)


async def scan_repository(repo, github_client, secrets_detector, dependency_analyzer):
    """Scan a single repository for secrets and dependency risks with optimizations"""
    results = {"secrets": [], "dependencies": []}
    
    try:
        # Get repository files
        files = await github_client.get_repository_files(repo["full_name"])
        
        # Filter files for scanning (optimize by skipping unnecessary files)
        scannable_files = [
            f for f in files 
            if f["type"] == "file" 
            and f["size"] < 512 * 1024  # Reduced from 1MB to 512KB for speed
            and not f["path"].startswith(('.git/', 'node_modules/', '.next/', 'dist/', 'build/'))
            and not f["name"].endswith(('.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'))
        ]
        
        # Limit files to scan (top 50 most recent or important files)
        scannable_files = scannable_files[:50]
        
        # Scan files sequentially to avoid API issues
        for file_info in scannable_files[:20]:  # Limit to 20 files for stability
            try:
                content = await github_client.get_file_content(repo["full_name"], file_info["path"])
                if content:
                    secrets = secrets_detector.scan_content(content, file_info["path"])
                    results["secrets"].extend(secrets)
            except Exception as e:
                print(f"Error scanning file {file_info['path']}: {e}")
                continue
        
        # Analyze dependencies (prioritize package files)
        package_files = [
            f for f in files 
            if f["name"] in ["package.json", "package-lock.json", "yarn.lock", "requirements.txt", "Pipfile", "Gemfile"]
        ]
        
        # Process dependency files sequentially
        for package_file in package_files:
            try:
                content = await github_client.get_file_content(repo["full_name"], package_file["path"])
                if content:
                    dependencies = await dependency_analyzer.analyze_dependencies(content, package_file["name"])
                    results["dependencies"].extend(dependencies)
            except Exception as e:
                print(f"Error analyzing dependencies in {package_file['path']}: {e}")
                continue
    
    except Exception as e:
        print(f"Error scanning repository {repo['full_name']}: {e}")
    
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
