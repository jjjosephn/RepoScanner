import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from models import Base

# Load env from predictable paths (CWD is unreliable when starting uvicorn/main from different folders).
# Later files override earlier ones so backend/.env.local wins over repo root .env.local.
_backend_dir = Path(__file__).resolve().parent
_repo_root = _backend_dir.parent
for _env_path in (
    _repo_root / ".env",
    _repo_root / ".env.local",
    _backend_dir / ".env",
    _backend_dir / ".env.local",
):
    if _env_path.is_file():
        load_dotenv(_env_path, override=True)

DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()
USE_DATABASE: bool = bool(DATABASE_URL)

_engine: Optional[AsyncEngine] = None
AsyncSessionLocal: Optional[async_sessionmaker[AsyncSession]] = None


def configure() -> None:
    global _engine, AsyncSessionLocal
    if not USE_DATABASE:
        return
    if _engine is not None:
        return
    _engine = create_async_engine(DATABASE_URL, echo=os.getenv("SQL_ECHO", "").lower() in ("1", "true", "yes"))
    AsyncSessionLocal = async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


def get_engine() -> Optional[AsyncEngine]:
    return _engine


async def init_db() -> None:
    configure()
    if not USE_DATABASE or _engine is None:
        return
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_engine() -> None:
    global _engine, AsyncSessionLocal
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        AsyncSessionLocal = None
