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
    """Background task to perform repository scanning"""
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
        scanned_count = 0
        total_secrets = 0
        total_dependencies = 0
        
        for i, repo in enumerate(repositories):
            try:
                # Update progress
                progress = int((i / total_repos) * 100)
                session["progress"] = progress
                
                # Scan repository
                repo_results = await scan_repository(
                    repo, github_client, secrets_detector, dependency_analyzer
                )
                
                # Store results
                result_key = f"{session['user_id']}_{repo['id']}"
                scan_results[result_key] = repo_results
                
                # Update counters
                scanned_count += 1
                total_secrets += len(repo_results["secrets"])
                total_dependencies += len(repo_results["dependencies"])
                
                session["scannedCount"] = scanned_count
                session["secretsFound"] = total_secrets
                session["dependencyRisks"] = total_dependencies
                
            except Exception as e:
                print(f"Error scanning repository {repo.get('name', 'unknown')}: {e}")
                continue
        
        # Mark as completed
        session["progress"] = 100
        session["completed"] = True
        session["endTime"] = datetime.utcnow().isoformat()
        
    except Exception as e:
        print(f"Error in scan session {session_id}: {e}")
        session["completed"] = True
        session["error"] = str(e)

async def scan_repository(repo, github_client, secrets_detector, dependency_analyzer):
    """Scan a single repository for secrets and dependency risks"""
    results = {"secrets": [], "dependencies": []}
    
    try:
        # Get repository files
        files = await github_client.get_repository_files(repo["full_name"])
        
        # Scan for secrets
        for file_info in files:
            if file_info["type"] == "file" and file_info["size"] < 1024 * 1024:  # Skip files > 1MB
                try:
                    content = await github_client.get_file_content(
                        repo["full_name"], file_info["path"]
                    )
                    
                    if content:
                        secrets = secrets_detector.scan_content(
                            content, file_info["path"]
                        )
                        results["secrets"].extend(secrets)
                        
                except Exception as e:
                    print(f"Error scanning file {file_info['path']}: {e}")
                    continue
        
        # Analyze dependencies
        package_files = [f for f in files if f["name"] in ["package.json", "package-lock.json", "yarn.lock"]]
        
        for package_file in package_files:
            try:
                content = await github_client.get_file_content(
                    repo["full_name"], package_file["path"]
                )
                
                if content:
                    dependencies = await dependency_analyzer.analyze_dependencies(
                        content, package_file["name"]
                    )
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
