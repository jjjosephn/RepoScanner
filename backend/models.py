import uuid
from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ScanSession(Base):
    __tablename__ = "scan_sessions"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    github_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    scanned_count: Mapped[int] = mapped_column(Integer, default=0)
    secrets_found: Mapped[int] = mapped_column(Integer, default=0)
    dependency_risks: Mapped[int] = mapped_column(Integer, default=0)
    total_repositories: Mapped[int] = mapped_column(Integer, default=0)
    repository_ids: Mapped[Optional[List[Any]]] = mapped_column(JSONB, nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    github_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    repository_id: Mapped[str] = mapped_column(String(64), nullable=False)
    secrets: Mapped[List[Any]] = mapped_column(JSONB, default=list)
    dependencies: Mapped[List[Any]] = mapped_column(JSONB, default=list)
    scanned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("github_user_id", "repository_id", name="uq_scan_results_user_repo"),
    )
