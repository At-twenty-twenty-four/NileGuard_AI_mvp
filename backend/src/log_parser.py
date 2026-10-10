"""
Parses lines from a Linux auth log into structured SSH authentication events.
Handles both classic syslog and RFC 3339 / ISO timestamps.
"""
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

_CLASSIC_PREFIX = re.compile(
    r"^(?P<ts>\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(?P<host>\S+)\s+sshd\[\d+\]:\s+(?P<msg>.*)$"
)
_ISO_PREFIX = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}))"
    r"\s+(?P<host>\S+)\s+sshd\[\d+\]:\s+(?P<msg>.*)$"
)
_FAILED = re.compile(
    r"^Failed password for (?:invalid user )?(?P<user>\S+) from (?P<ip>[\d.]+) port (?P<port>\d+)"
)
_ACCEPTED = re.compile(
    r"^Accepted (?:password|publickey) for (?P<user>\S+) from (?P<ip>[\d.]+) port (?P<port>\d+)"
)
_INVALID_USER = re.compile(
    r"^Invalid user (?P<user>\S+) from (?P<ip>[\d.]+) port (?P<port>\d+)"
)


@dataclass
class SSHEvent:
    timestamp: datetime
    host: str
    event_type: str  # "failed_login" | "accepted_login" | "invalid_user"
    username: str
    source_ip: str
    port: int
    raw_line: str


def _parse_classic_timestamp(ts_str: str, reference_year: Optional[int] = None) -> datetime:
    year = reference_year or datetime.now().year
    normalized = " ".join(ts_str.split())
    return datetime.strptime(f"{year} {normalized}", "%Y %b %d %H:%M:%S")


def _parse_iso_timestamp(ts_str: str) -> datetime:
    if ts_str.endswith("Z"):
        ts_str = ts_str[:-1] + "+00:00"
    return datetime.fromisoformat(ts_str)


def parse_line(line: str, reference_year: Optional[int] = None) -> Optional[SSHEvent]:
    stripped = line.strip()
    prefix_match = _ISO_PREFIX.match(stripped) or _CLASSIC_PREFIX.match(stripped)
    if not prefix_match:
        return None

    ts_str = prefix_match.group("ts")
    host = prefix_match.group("host")
    msg = prefix_match.group("msg")

    for pattern, event_type in (
        (_FAILED, "failed_login"),
        (_ACCEPTED, "accepted_login"),
        (_INVALID_USER, "invalid_user"),
    ):
        m = pattern.match(msg)
        if m:
            try:
                if "T" in ts_str:
                    timestamp = _parse_iso_timestamp(ts_str)
                else:
                    timestamp = _parse_classic_timestamp(ts_str, reference_year)
            except ValueError:
                return None
            return SSHEvent(
                timestamp=timestamp,
                host=host,
                event_type=event_type,
                username=m.group("user"),
                source_ip=m.group("ip"),
                port=int(m.group("port")),
                raw_line=line.strip(),
            )
    return None


def parse_log_file(path: str, reference_year: Optional[int] = None):
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            event = parse_line(line, reference_year=reference_year)
            if event:
                yield event
