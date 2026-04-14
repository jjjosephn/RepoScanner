from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Any, Awaitable, Callable, Dict, List, Optional
import httpx
import asyncio
import os
import uuid

import database
import persistence as scan_store
from models import ScanSession
from scanner.secrets_detector import SecretsDetector
from scanner.dependency_analyzer import DependencyAnalyzer
from scanner.github_client import GitHubClient

security = HTTPBearer()

# In-memory storage when DATABASE_URL is not set
scan_sessions: Dict[str, Dict] = {}
scan_results: Dict[str, Dict] = {}
scan_tasks: Dict[str, asyncio.Task] = {}
# Live per-session hints for status polling (esp. current file during single-repo scans; DB path avoids extra columns).
scan_live_state: Dict[str, Dict[str, Any]] = {}


def _scan_live_update(
    session_id: str,
    *,
    current_file: Optional[str],
    file_index: int,
    file_total: int,
) -> None:
    scan_live_state[session_id] = {
        "currentFile": current_file or "",
        "fileIndex": file_index,
        "fileTotal": file_total,
    }


def _scan_live_clear(session_id: str) -> None:
    scan_live_state.pop(session_id, None)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _progress_mid_repo(i: int, total_repos: int) -> int:
    """While a repo is being scanned, show ~half of that repo's slice so the bar moves during long work."""
    if total_repos <= 0:
        return 100
    return min(99, max(1, int(100 * (i + 0.5) / total_repos)))


def _progress_after_repo(i: int, total_repos: int) -> int:
    if total_repos <= 0:
        return 100
    return min(100, int(100 * (i + 1) / total_repos))


FileProgressCallback = Optional[Callable[[int, int, Optional[str]], Awaitable[None]]]


def _use_db() -> bool:
    return database.USE_DATABASE


@asynccontextmanager
async def lifespan(app: FastAPI):
    if database.USE_DATABASE:
        print("RepoScanner: persisting scans to PostgreSQL (DATABASE_URL is set).")
    else:
        print(
            "RepoScanner: in-memory scan storage only — restarts lose data. "
            "Set DATABASE_URL (see backend/.env.example); can live in repo .env.local or backend/.env."
        )
    await database.init_db()
    yield
    await database.dispose_engine()


app = FastAPI(title="RepoScanner Backend", version="1.0.0", lifespan=lifespan)

_frontend_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _frontend_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    repositoryIds: Optional[List[str]] = None
    githubToken: str


class ScanStatus(BaseModel):
    progress: int
    completed: bool
    scannedCount: int
    secretsFound: int
    dependencyRisks: int
    totalRepositories: int = 0
    currentFile: Optional[str] = None
    fileIndex: int = 0
    fileTotal: int = 0


async def verify_github_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify GitHub token and return user info"""
    token = credentials.credentials

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {token}"},
        )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")

        return {"token": token, "user": response.json()}


@app.post("/api/scan")
async def start_scan(
    scan_request: ScanRequest,
    auth_data: dict = Depends(verify_github_token),
):
    """Start repository scanning process"""
    session_id = str(uuid.uuid4())
    user_id = auth_data["user"]["id"]

    if _use_db():
        database.configure()
        assert database.AsyncSessionLocal is not None
        async with database.AsyncSessionLocal() as db:
            await scan_store.create_scan_session(
                db,
                session_id=uuid.UUID(session_id),
                github_user_id=user_id,
                repository_ids=scan_request.repositoryIds,
            )
        task = asyncio.create_task(
            perform_scan_db(session_id, scan_request.githubToken, scan_request.repositoryIds)
        )
    else:
        scan_sessions[session_id] = {
            "id": session_id,
            "user_id": user_id,
            "progress": 0,
            "completed": False,
            "scannedCount": 0,
            "secretsFound": 0,
            "dependencyRisks": 0,
            "startTime": _utcnow_iso(),
            "repositoryIds": scan_request.repositoryIds,
        }
        task = asyncio.create_task(
            perform_scan_memory(session_id, scan_request.githubToken, scan_request.repositoryIds)
        )

    scan_tasks[session_id] = task

    def cleanup_task(_t: asyncio.Task) -> None:
        if session_id in scan_tasks:
            del scan_tasks[session_id]

    task.add_done_callback(cleanup_task)

    return {"sessionId": session_id, "status": "started"}


@app.get("/api/scan/status")
async def get_scan_status(auth_data: dict = Depends(verify_github_token)):
    """Get current scan status for the user"""
    user_id = auth_data["user"]["id"]

    if _use_db():
        database.configure()
        assert database.AsyncSessionLocal is not None
        async with database.AsyncSessionLocal() as db:
            row = await scan_store.get_latest_session_for_user(db, user_id)
        if not row:
            return ScanStatus(
                progress=0,
                completed=True,
                scannedCount=0,
                secretsFound=0,
                dependencyRisks=0,
                totalRepositories=0,
            )
        live = scan_live_state.get(str(row.id), {})
        cf = live.get("currentFile")
        return ScanStatus(
            progress=row.progress,
            completed=row.completed,
            scannedCount=row.scanned_count,
            secretsFound=row.secrets_found,
            dependencyRisks=row.dependency_risks,
            totalRepositories=row.total_repositories,
            currentFile=cf if cf else None,
            fileIndex=int(live.get("fileIndex") or 0),
            fileTotal=int(live.get("fileTotal") or 0),
        )

    user_sessions = [s for s in scan_sessions.values() if s["user_id"] == user_id]
    if not user_sessions:
        return ScanStatus(
            progress=0,
            completed=True,
            scannedCount=0,
            secretsFound=0,
            dependencyRisks=0,
            totalRepositories=0,
        )
    latest_session = max(user_sessions, key=lambda x: x["startTime"])
    sid = str(latest_session["id"])
    live = scan_live_state.get(sid, {})
    cf = live.get("currentFile")
    return ScanStatus(
        progress=latest_session["progress"],
        completed=latest_session["completed"],
        scannedCount=latest_session["scannedCount"],
        secretsFound=latest_session["secretsFound"],
        dependencyRisks=latest_session["dependencyRisks"],
        totalRepositories=latest_session.get("totalRepositories", 0),
        currentFile=cf if cf else None,
        fileIndex=int(live.get("fileIndex") or 0),
        fileTotal=int(live.get("fileTotal") or 0),
    )


@app.post("/api/scan/cancel")
async def cancel_scan(auth_data: dict = Depends(verify_github_token)):
    """Cancel the current scan for the user"""
    user_id = auth_data["user"]["id"]

    if _use_db():
        database.configure()
        assert database.AsyncSessionLocal is not None
        async with database.AsyncSessionLocal() as db:
            active = await scan_store.get_active_sessions_for_user(db, user_id)
        if not active:
            raise HTTPException(status_code=404, detail="No active scan found")
        latest_session = active[0]
        session_id = str(latest_session.id)
        if session_id in scan_tasks:
            scan_tasks[session_id].cancel()
            del scan_tasks[session_id]
        async with database.AsyncSessionLocal() as db:
            await scan_store.mark_scan_cancelled(db, latest_session.id)
        return {"status": "cancelled", "sessionId": session_id}

    user_sessions = [
        s for s in scan_sessions.values() if s["user_id"] == user_id and not s["completed"]
    ]
    if not user_sessions:
        raise HTTPException(status_code=404, detail="No active scan found")
    latest_session = max(user_sessions, key=lambda x: x["startTime"])
    session_id = latest_session["id"]
    if session_id in scan_tasks:
        scan_tasks[session_id].cancel()
        del scan_tasks[session_id]
    latest_session["completed"] = True
    latest_session["cancelled"] = True
    latest_session["endTime"] = _utcnow_iso()
    return {"status": "cancelled", "sessionId": session_id}


@app.get("/scan/results")
async def get_all_scan_results(auth_data: dict = Depends(verify_github_token)):
    """Get all scan results for the user"""
    user_id = auth_data["user"]["id"]

    if _use_db():
        database.configure()
        assert database.AsyncSessionLocal is not None
        async with database.AsyncSessionLocal() as db:
            user_results = await scan_store.list_scan_results_for_user(db, user_id)
        return {"results": user_results}

    user_results = {}
    for key, result in scan_results.items():
        if key.startswith(f"{user_id}_"):
            repo_id = key.split("_", 1)[1]
            user_results[repo_id] = result
    return {"results": user_results}


@app.get("/api/scan/results/{repository_id}")
async def get_scan_results(repository_id: str, auth_data: dict = Depends(verify_github_token)):
    """Get scan results for a specific repository"""
    user_id = auth_data["user"]["id"]

    if _use_db():
        database.configure()
        assert database.AsyncSessionLocal is not None
        async with database.AsyncSessionLocal() as db:
            row = await scan_store.get_scan_result_for_repo(db, user_id, repository_id)
        if not row:
            return {"secrets": [], "dependencies": []}
        return {
            "secrets": row.secrets or [],
            "dependencies": row.dependencies or [],
            "scannedAt": row.scanned_at.isoformat() if row.scanned_at else None,
        }

    result_key = f"{user_id}_{repository_id}"
    if result_key not in scan_results:
        return {"secrets": [], "dependencies": []}
    return scan_results[result_key]


async def perform_scan_memory(
    session_id: str, github_token: str, repository_ids: Optional[List[str]]
):
    """Background task: in-memory session updates"""
    session: Optional[Dict] = None
    try:
        session = scan_sessions[session_id]
        github_client = GitHubClient(github_token)
        secrets_detector = SecretsDetector()
        dependency_analyzer = DependencyAnalyzer()

        if repository_ids:
            repositories = await github_client.get_repositories_by_ids(repository_ids)
        else:
            repositories = await github_client.get_all_repositories()

        total_repos = len(repositories)
        session["progress"] = 0
        session["scannedCount"] = 0
        session["secretsFound"] = 0
        session["dependencyRisks"] = 0
        session["totalRepositories"] = total_repos

        stopped_cancelled = False
        for i, repo in enumerate(repositories):
            if session_id in scan_sessions and scan_sessions[session_id].get("cancelled", False):
                print(f"Scan {session_id} was cancelled by user")
                stopped_cancelled = True
                break

            try:
                if total_repos != 1:
                    session["progress"] = _progress_mid_repo(i, total_repos)

                print(f"Scanning repository {i+1}/{total_repos}: {repo.get('name', 'unknown')}")

                async def _file_progress_memory(
                    done: int, total: int, path: Optional[str]
                ) -> None:
                    session["progress"] = min(99, max(1, int(100 * done / max(total, 1))))
                    _scan_live_update(
                        session_id,
                        current_file=path,
                        file_index=done,
                        file_total=total,
                    )

                repo_results = await scan_repository(
                    repo,
                    github_client,
                    secrets_detector,
                    dependency_analyzer,
                    on_file_progress=_file_progress_memory if total_repos == 1 else None,
                )

                result_key = f"{session['user_id']}_{repo['id']}"
                scan_results[result_key] = {**repo_results, "scannedAt": _utcnow_iso()}

                session["scannedCount"] += 1
                session["secretsFound"] += len(repo_results["secrets"])
                session["dependencyRisks"] += len(repo_results["dependencies"])
                current_progress = _progress_after_repo(i, total_repos)
                session["progress"] = current_progress
                print(f"Completed {session['scannedCount']}/{total_repos} repositories ({current_progress}%)")
                await asyncio.sleep(0.5)
            except Exception as e:
                print(f"Error scanning repository {repo.get('name', 'unknown')}: {e}")
                continue

        if not stopped_cancelled:
            session["progress"] = 100
        session["completed"] = True
        session["endTime"] = _utcnow_iso()

    except asyncio.CancelledError:
        print(f"Scan session {session_id} was cancelled")
        if session is not None:
            session["completed"] = True
            session["error"] = "Scan was cancelled"
    except Exception as e:
        print(f"Error in scan session {session_id}: {e}")
        if session is not None:
            session["completed"] = True
            session["error"] = str(e)
    finally:
        _scan_live_clear(session_id)


async def perform_scan_db(session_id: str, github_token: str, repository_ids: Optional[List[str]]):
    """Background task: persist session and results to PostgreSQL"""
    database.configure()
    if database.AsyncSessionLocal is None:
        return

    sid = uuid.UUID(session_id)

    try:
        async with database.AsyncSessionLocal() as db:
            sess = await db.get(ScanSession, sid)
            if sess is None:
                return

            github_client = GitHubClient(github_token)
            secrets_detector = SecretsDetector()
            dependency_analyzer = DependencyAnalyzer()

            if repository_ids:
                repositories = await github_client.get_repositories_by_ids(repository_ids)
            else:
                repositories = await github_client.get_all_repositories()

            total_repos = len(repositories)
            sess.progress = 0
            sess.scanned_count = 0
            sess.secrets_found = 0
            sess.dependency_risks = 0
            sess.total_repositories = total_repos
            await db.commit()

            user_id = sess.github_user_id

            if total_repos == 0:
                sess.progress = 100
                sess.completed = True
                sess.end_time = datetime.now(timezone.utc)
                await db.commit()
                return

            for i, repo in enumerate(repositories):
                await db.refresh(sess, attribute_names=["cancelled"])
                if sess.cancelled:
                    print(f"Scan {session_id} was cancelled by user")
                    break

                try:
                    if total_repos != 1:
                        sess.progress = _progress_mid_repo(i, total_repos)
                        await db.commit()

                    print(f"Scanning repository {i+1}/{total_repos}: {repo.get('name', 'unknown')}")

                    async def _file_progress_db(
                        done: int, total: int, path: Optional[str]
                    ) -> None:
                        sess.progress = min(99, max(1, int(100 * done / max(total, 1))))
                        await db.commit()
                        _scan_live_update(
                            session_id,
                            current_file=path,
                            file_index=done,
                            file_total=total,
                        )

                    repo_results = await scan_repository(
                        repo,
                        github_client,
                        secrets_detector,
                        dependency_analyzer,
                        on_file_progress=_file_progress_db if total_repos == 1 else None,
                    )

                    scanned_at = datetime.now(timezone.utc)
                    await scan_store.upsert_scan_result(
                        db,
                        github_user_id=user_id,
                        repository_id=str(repo["id"]),
                        secrets=repo_results["secrets"],
                        dependencies=repo_results["dependencies"],
                        scanned_at=scanned_at,
                    )

                    sess.scanned_count += 1
                    sess.secrets_found += len(repo_results["secrets"])
                    sess.dependency_risks += len(repo_results["dependencies"])
                    sess.progress = _progress_after_repo(i, total_repos)
                    await db.commit()

                    print(
                        f"Completed {sess.scanned_count}/{total_repos} repositories ({sess.progress}%)"
                    )
                    await asyncio.sleep(0.5)
                except Exception as e:
                    print(f"Error scanning repository {repo.get('name', 'unknown')}: {e}")
                    continue

            await db.refresh(sess, attribute_names=["cancelled"])
            if sess.cancelled:
                if sess.end_time is None:
                    sess.end_time = datetime.now(timezone.utc)
            else:
                sess.progress = 100
                sess.completed = True
                sess.end_time = datetime.now(timezone.utc)
            await db.commit()

    except asyncio.CancelledError:
        print(f"Scan session {session_id} was cancelled")
        async with database.AsyncSessionLocal() as db:
            sess = await db.get(ScanSession, sid)
            if sess:
                sess.completed = True
                sess.error = "Scan was cancelled"
                sess.end_time = datetime.now(timezone.utc)
                await db.commit()
    except Exception as e:
        print(f"Error in scan session {session_id}: {e}")
        async with database.AsyncSessionLocal() as db:
            sess = await db.get(ScanSession, sid)
            if sess:
                sess.completed = True
                sess.error = str(e)
                sess.end_time = datetime.now(timezone.utc)
                await db.commit()
    finally:
        _scan_live_clear(session_id)


async def scan_repository(
    repo,
    github_client,
    secrets_detector,
    dependency_analyzer,
    *,
    on_file_progress: FileProgressCallback = None,
):
    """Scan a single repository for secrets and dependency risks with optimizations.

    When ``on_file_progress`` is set (single-repo scans), it is awaited after each
    content file and each dependency manifest:
    ``(completed_steps, total_steps, path_or_none)``.
    """
    results = {"secrets": [], "dependencies": []}

    try:
        files = await github_client.get_repository_files(repo["full_name"])

        scannable_files = [
            f
            for f in files
            if f["type"] == "file"
            and f["size"] < 512 * 1024
            and not f["path"].startswith((".git/", "node_modules/", ".next/", "dist/", "build/"))
            and not f["name"].endswith(
                (".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2")
            )
        ]

        scannable_files = scannable_files[:50]
        secret_files = scannable_files[:20]

        package_files = [
            f
            for f in files
            if f["name"]
            in ["package.json", "package-lock.json", "yarn.lock", "requirements.txt", "Pipfile", "Gemfile"]
        ]

        total_steps = len(secret_files) + len(package_files)
        step = 0

        async def _bump(path: Optional[str] = None) -> None:
            nonlocal step
            if not on_file_progress or total_steps <= 0:
                return
            step += 1
            await on_file_progress(step, total_steps, path)

        for file_info in secret_files:
            try:
                content = await github_client.get_file_content(repo["full_name"], file_info["path"])
                if content:
                    secrets = secrets_detector.scan_content(content, file_info["path"])
                    results["secrets"].extend(secrets)
            except Exception as e:
                print(f"Error scanning file {file_info['path']}: {e}")
            await _bump(file_info["path"])

        for package_file in package_files:
            try:
                content = await github_client.get_file_content(repo["full_name"], package_file["path"])
                if content:
                    dependencies = await dependency_analyzer.analyze_dependencies(
                        content, package_file["name"]
                    )
                    results["dependencies"].extend(dependencies)
            except Exception as e:
                print(f"Error analyzing dependencies in {package_file['path']}: {e}")
            await _bump(package_file["path"])

        if total_steps == 0 and on_file_progress:
            await on_file_progress(1, 1, None)

    except Exception as e:
        print(f"Error scanning repository {repo['full_name']}: {e}")

    return results


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
