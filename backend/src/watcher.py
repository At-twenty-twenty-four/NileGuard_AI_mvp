"""
Tails a live auth log file.
"""
import time
from typing import Iterator
from log_parser import parse_line, SSHEvent


def tail_file(path: str, poll_interval: float = 1.0) -> Iterator[SSHEvent]:
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        f.seek(0, 2)
        while True:
            line = f.readline()
            if not line:
                time.sleep(poll_interval)
                continue
            event = parse_line(line)
            if event:
                yield event
