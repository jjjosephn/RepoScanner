from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models import ScanResult, ScanSession


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def create_scan_session(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    github_user_id: int,
    repository_ids: Optional[List[str]],
) -> ScanSession:
    row = ScanSession(
        id=session_id,
        github_user_id=github_user_id,
        repository_ids=repository_ids,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def get_latest_session_for_user(db: AsyncSession, github_user_id: int) -> Optional[ScanSession]:
    stmt = (
        select(ScanSession)
        .where(ScanSession.github_user_id == github_user_id)
        .order_by(ScanSession.start_time.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_active_sessions_for_user(db: AsyncSession, github_user_id: int) -> List[ScanSession]:
    stmt = (
        select(ScanSession)
        .where(ScanSession.github_user_id == github_user_id, ScanSession.completed.is_(False))
        .order_by(ScanSession.start_time.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_scan_session_by_id(db: AsyncSession, session_id: uuid.UUID) -> Optional[ScanSession]:
    return await db.get(ScanSession, session_id)


async def refresh_scan_session(db: AsyncSession, row: ScanSession) -> None:
    await db.refresh(row)


async def update_scan_session_fields(db: AsyncSession, session_id: uuid.UUID, **fields: Any) -> None:
    if not fields:
        return
    stmt = update(ScanSession).where(ScanSession.id == session_id).values(**fields)
    await db.execute(stmt)
    await db.commit()


async def mark_scan_cancelled(db: AsyncSession, session_id: uuid.UUID) -> None:
    await update_scan_session_fields(
        db,
        session_id,
        completed=True,
        cancelled=True,
        end_time=_utcnow(),
    )


async def upsert_scan_result(
    db: AsyncSession,
    *,
    github_user_id: int,
    repository_id: str,
    secrets: List[Any],
    dependencies: List[Any],
    scanned_at: datetime,
) -> None:
    stmt = pg_insert(ScanResult).values(
        github_user_id=github_user_id,
        repository_id=repository_id,
        secrets=secrets,
        dependencies=dependencies,
        scanned_at=scanned_at,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_scan_results_user_repo",
        set_={
            "secrets": stmt.excluded.secrets,
            "dependencies": stmt.excluded.dependencies,
            "scanned_at": stmt.excluded.scanned_at,
        },
    )
    await db.execute(stmt)
    await db.commit()


async def get_scan_result_for_repo(
    db: AsyncSession, github_user_id: int, repository_id: str
) -> Optional[ScanResult]:
    stmt = select(ScanResult).where(
        ScanResult.github_user_id == github_user_id,
        ScanResult.repository_id == repository_id,
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_scan_results_for_user(db: AsyncSession, github_user_id: int) -> Dict[str, Dict[str, Any]]:
    stmt = select(ScanResult).where(ScanResult.github_user_id == github_user_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    out: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        out[row.repository_id] = {
            "secrets": row.secrets or [],
            "dependencies": row.dependencies or [],
            "scannedAt": row.scanned_at.isoformat() if row.scanned_at else None,
        }
    return out
