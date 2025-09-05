import httpx
import base64
from typing import List, Dict, Any, Optional
import asyncio

class GitHubClient:
    def __init__(self, token: str):
        self.token = token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "RepoScanner/1.0"
        }
    
    async def get_all_repositories(self) -> List[Dict[str, Any]]:
        """Get all repositories accessible to the user"""
        repositories = []
        page = 1
        per_page = 100
        
        async with httpx.AsyncClient() as client:
            while True:
                response = await client.get(
                    f"{self.base_url}/user/repos",
                    headers=self.headers,
                    params={
                        "per_page": per_page,
                        "page": page,
                        "sort": "updated",
                        "type": "all"
                    }
                )
                
                if response.status_code != 200:
                    break
                
                repos = response.json()
                if not repos:
                    break
                
                repositories.extend(repos)
                
                if len(repos) < per_page:
                    break
                
                page += 1
        
        return repositories
    
    async def get_repositories_by_ids(self, repo_ids: List[str]) -> List[Dict[str, Any]]:
        """Get specific repositories by their IDs"""
        repositories = []
        
        async with httpx.AsyncClient() as client:
            for repo_id in repo_ids:
                try:
                    response = await client.get(
                        f"{self.base_url}/repositories/{repo_id}",
                        headers=self.headers
                    )
                    
                    if response.status_code == 200:
                        repositories.append(response.json())
                except Exception as e:
                    print(f"Error fetching repository {repo_id}: {e}")
                    continue
        
        return repositories
    
    async def get_repository_files(self, repo_full_name: str, path: str = "") -> List[Dict[str, Any]]:
        """Get files in a repository recursively"""
        files = []
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/repos/{repo_full_name}/contents/{path}",
                    headers=self.headers
                )
                
                if response.status_code != 200:
                    return files
                
                contents = response.json()
                
                # Handle single file response
                if isinstance(contents, dict):
                    contents = [contents]
                
                for item in contents:
                    if item["type"] == "file":
                        files.append(item)
                    elif item["type"] == "dir" and not self._should_skip_directory(item["name"]):
                        # Recursively get files from subdirectories
                        subfiles = await self.get_repository_files(repo_full_name, item["path"])
                        files.extend(subfiles)
            
            except Exception as e:
                print(f"Error getting repository files for {repo_full_name}: {e}")
        
        return files
    
    def _should_skip_directory(self, dir_name: str) -> bool:
        """Check if directory should be skipped during scanning"""
        skip_dirs = {
            ".git", "node_modules", ".next", "dist", "build", 
            ".vscode", ".idea", "__pycache__", ".pytest_cache",
            "coverage", ".nyc_output", "logs", "tmp", "temp"
        }
        return dir_name in skip_dirs
    
    async def get_file_content(self, repo_full_name: str, file_path: str) -> Optional[str]:
        """Get the content of a specific file"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/repos/{repo_full_name}/contents/{file_path}",
                    headers=self.headers
                )
                
                if response.status_code != 200:
                    return None
                
                file_data = response.json()
                
                # GitHub API returns file content base64 encoded
                if file_data.get("encoding") == "base64":
                    content = base64.b64decode(file_data["content"]).decode("utf-8", errors="ignore")
                    return content
                
                return file_data.get("content", "")
            
            except Exception as e:
                print(f"Error getting file content for {repo_full_name}/{file_path}: {e}")
                return None
    
    async def get_repository_info(self, repo_full_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a repository"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/repos/{repo_full_name}",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    return response.json()
                
                return None
            
            except Exception as e:
                print(f"Error getting repository info for {repo_full_name}: {e}")
                return None
    
    async def check_rate_limit(self) -> Dict[str, Any]:
        """Check current rate limit status"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/rate_limit",
                    headers=self.headers
                )
                
                if response.status_code == 200:
                    return response.json()
                
                return {}
            
            except Exception as e:
                print(f"Error checking rate limit: {e}")
                return {}
