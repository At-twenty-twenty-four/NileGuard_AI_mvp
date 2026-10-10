"""
Postgres storage for NileGuard incidents.
Uses the same database as the Next.js + Better Auth frontend.
"""
import os
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, List, Optional

import psycopg2
import psycopg2.extras

from detector import Incident

DATABASE_URL = os.environ.get("DATABASE_URL")


@contextmanager
def _connect():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_incident(incident: Incident, explanation: str, host_id: int = 1) -> int:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO incidents
                    (host_id, source_ip, first_seen, last_seen, attempt_count,
                     usernames_tried, window_minutes, severity, explanation, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    host_id,
                    incident.source_ip,
                    incident.first_seen,
                    incident.last_seen,
                    incident.attempt_count,
                    ",".join(incident.usernames_tried),
                    incident.window_minutes,
                    incident.severity,
                    explanation,
                    datetime.now().astimezone(),
                ),
            )
            return cur.fetchone()[0]


def mark_alert_sent(incident_id: int, channel: str) -> None:
    column = {"telegram": "telegram_sent", "email": "email_sent"}[channel]
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE incidents SET {column} = TRUE WHERE id = %s",
                (incident_id,),
            )


def save_cooldown(source_ip: str, last_alerted_at: datetime) -> None:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO incident_cooldowns (source_ip, last_alerted_at)
                VALUES (%s, %s)
                ON CONFLICT (source_ip)
                DO UPDATE SET last_alerted_at = EXCLUDED.last_alerted_at
                """,
                (source_ip, last_alerted_at),
            )


def load_cooldowns() -> Dict[str, datetime]:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT source_ip, last_alerted_at FROM incident_cooldowns")
            return {row[0]: row[1] for row in cur.fetchall()}


def recent_incidents(limit: int = 200) -> List[dict]:
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM incidents
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            return [dict(row) for row in cur.fetchall()]


_SEVERITY_RANK = {"critical": 3, "high": 2, "medium": 1}


def grouped_incidents(resolved: bool = False) -> List[dict]:
    rows = recent_incidents(limit=1000)
    groups: Dict[str, dict] = {}
    for row in rows:
        if bool(row["resolved"]) != resolved:
            continue
        ip = row["source_ip"]
        g = groups.get(ip)
        if g is None:
            groups[ip] = {
                "source_ip": ip,
                "occurrences": 1,
                "max_attempts": row["attempt_count"],
                "severity": row["severity"],
                "last_seen": row["created_at"].isoformat() if row["created_at"] else None,
                "explanation": row["explanation"],
                "usernames_tried": set(row["usernames_tried"].split(",")),
                "latest_id": row["id"],
            }
        else:
            g["occurrences"] += 1
            g["max_attempts"] = max(g["max_attempts"], row["attempt_count"])
            g["usernames_tried"].update(row["usernames_tried"].split(","))
            if _SEVERITY_RANK.get(row["severity"], 0) > _SEVERITY_RANK.get(g["severity"], 0):
                g["severity"] = row["severity"]

    result = list(groups.values())
    for g in result:
        g["usernames_tried"] = sorted(g["usernames_tried"])
    result.sort(key=lambda g: _SEVERITY_RANK.get(g["severity"], 0), reverse=True)
    return result


def resolve_ip(source_ip: str) -> int:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE incidents SET resolved = TRUE WHERE source_ip = %s AND resolved = FALSE",
                (source_ip,),
            )
            return cur.rowcount


def summary_counts() -> dict:
    active = grouped_incidents(resolved=False)
    resolved = grouped_incidents(resolved=True)
    return {
        "active_ips": len(active),
        "total_detections": sum(g["occurrences"] for g in active),
        "critical_or_high": sum(1 for g in active if g["severity"] in ("critical", "high")),
        "resolved_ips": len(resolved),
    }
