"""
Threshold-based SSH brute-force detection.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from log_parser import SSHEvent


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.astimezone()
    return dt


@dataclass
class Incident:
    source_ip: str
    first_seen: datetime
    last_seen: datetime
    attempt_count: int
    usernames_tried: List[str]
    window_minutes: int
    severity: str  # "medium" | "high" | "critical"


@dataclass
class _IPWindow:
    attempts: List[SSHEvent] = field(default_factory=list)
    last_alerted_at: Optional[datetime] = None


class BruteForceDetector:
    def __init__(
        self,
        fail_threshold: int = 5,
        window_minutes: int = 5,
        realert_cooldown_minutes: int = 30,
    ):
        self.fail_threshold = fail_threshold
        self.window = timedelta(minutes=window_minutes)
        self.realert_cooldown = timedelta(minutes=realert_cooldown_minutes)
        self._windows: Dict[str, _IPWindow] = {}

    def _severity_for(self, attempt_count: int) -> str:
        if attempt_count >= self.fail_threshold * 4:
            return "critical"
        if attempt_count >= self.fail_threshold * 2:
            return "high"
        return "medium"

    def process(self, event: SSHEvent) -> Optional[Incident]:
        if event.event_type == "accepted_login":
            return None

        ts = _ensure_aware(event.timestamp)
        ip_window = self._windows.setdefault(event.source_ip, _IPWindow())
        ip_window.attempts.append(event)

        cutoff = ts - self.window
        ip_window.attempts = [
            a for a in ip_window.attempts if _ensure_aware(a.timestamp) >= cutoff
        ]

        attempt_count = len(ip_window.attempts)
        if attempt_count < self.fail_threshold:
            return None

        if (
            ip_window.last_alerted_at is not None
            and ts - _ensure_aware(ip_window.last_alerted_at) < self.realert_cooldown
        ):
            return None

        ip_window.last_alerted_at = ts
        usernames = sorted({a.username for a in ip_window.attempts})

        return Incident(
            source_ip=event.source_ip,
            first_seen=_ensure_aware(ip_window.attempts[0].timestamp),
            last_seen=_ensure_aware(ip_window.attempts[-1].timestamp),
            attempt_count=attempt_count,
            usernames_tried=usernames,
            window_minutes=int(self.window.total_seconds() // 60),
            severity=self._severity_for(attempt_count),
        )

    def seed_cooldown(self, source_ip: str, last_alerted_at: datetime) -> None:
        window = self._windows.setdefault(source_ip, _IPWindow())
        window.last_alerted_at = _ensure_aware(last_alerted_at)
