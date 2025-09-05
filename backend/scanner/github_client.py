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
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                try:
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
                    
                except Exception as e:
                    print(f"Error fetching repositories page {page}: {e}")
                    break
        
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
        """Get files in a repository recursively with timeout and rate limiting"""
        files = []
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.get(
                    f"{self.base_url}/repos/{repo_full_name}/contents/{path}",
                    headers=self.headers
                )
                
                if response.status_code == 403:
                    print(f"Rate limited or forbidden access for {repo_full_name}")
                    return files
                elif response.status_code != 200:
                    print(f"HTTP {response.status_code} for {repo_full_name}")
                    return files
                
                contents = response.json()
                
                # Handle single file response
                if isinstance(contents, dict):
                    contents = [contents]
                
                for item in contents:
                    if item["type"] == "file":
                        files.append(item)
                    elif item["type"] == "dir" and not self._should_skip_directory(item["name"]) and len(files) < 100:
                        # Limit recursion and add delay to avoid rate limiting
                        await asyncio.sleep(0.1)
                        subfiles = await self.get_repository_files(repo_full_name, item["path"])
                        files.extend(subfiles)
                        
                        # Stop if we have enough files
                        if len(files) >= 100:
                            break
            
            except httpx.TimeoutException:
                print(f"Timeout getting repository files for {repo_full_name}")
            except Exception as e:
                print(f"Error getting repository files for {repo_full_name}: {e}")
        
        return files[:100]  # Limit to 100 files max
    
    def _should_skip_directory(self, dir_name: str) -> bool:
        """Check if directory should be skipped during scanning"""
        skip_dirs = {
            ".git", "node_modules", ".next", "dist", "build", 
            ".vscode", ".idea", "__pycache__", ".pytest_cache",
            "coverage", ".nyc_output", "logs", "tmp", "temp"
        }
        return dir_name in skip_dirs
    
    async def get_file_content(self, repo_name: str, file_path: str) -> str:
        """Get the content of a specific file"""
        try:
            url = f"https://api.github.com/repos/{repo_name}/contents/{file_path}"
            
            async with httpx.AsyncClient(timeout=10.0) as client:  
                response = await client.get(
                    url,
                    headers=self.headers
                )
                
                if response.status_code == 403:
                    print(f"Rate limit hit for file {file_path}")
                    return ""  
                
                if response.status_code != 200:
                    return ""
                
                data = response.json()
                
                # Handle different content types
                if data.get("type") == "file" and "content" in data:
                    import base64
                    try:
                        content = base64.b64decode(data["content"]).decode("utf-8")
                        return content
                    except UnicodeDecodeError:
                        # Skip binary files
                        return ""
                
                return ""
                
        except (asyncio.TimeoutError, httpx.TimeoutException):
            return ""  
        except Exception as e:
            return ""  
    
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
