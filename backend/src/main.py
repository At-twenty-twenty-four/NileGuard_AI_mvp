"""
Orchestrates: parse → detect → explain → store → alert.
"""
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env.local")

import alerts
import storage
from detector import BruteForceDetector
from explainer import explain
from log_parser import parse_log_file
from watcher import tail_file


def _new_detector() -> BruteForceDetector:
    detector = BruteForceDetector()
    for ip, last_alerted in storage.load_cooldowns().items():
        detector.seed_cooldown(ip, last_alerted)
    return detector


def _handle_incident(incident) -> None:
    explanation = explain(incident)
    incident_id = storage.save_incident(incident, explanation)
    storage.save_cooldown(incident.source_ip, incident.last_seen)

    message = (
        f"🚨 NileGuard AI Alert [{incident.severity.upper()}]\n"
        f"Source IP: {incident.source_ip}\n"
        f"{incident.attempt_count} failed attempts in {incident.window_minutes} min\n\n"
        f"{explanation}"
    )
    print("\n" + "=" * 70)
    print(message)
    print("=" * 70)

    if alerts.send_telegram_alert(message):
        storage.mark_alert_sent(incident_id, "telegram")
    if alerts.send_email_alert(
        subject=f"NileGuard AI: {incident.severity} alert from {incident.source_ip}",
        message=message,
    ):
        storage.mark_alert_sent(incident_id, "email")


def run_replay(log_path: str) -> None:
    detector = _new_detector()
    count = 0
    for event in parse_log_file(log_path, reference_year=2026):
        incident = detector.process(event)
        if incident:
            _handle_incident(incident)
            count += 1
    print(f"\nReplay complete. {count} incident(s) detected and stored.")


def run_watch(log_path: str) -> None:
    detector = _new_detector()
    print(f"Watching {log_path} for SSH auth events... (Ctrl+C to stop)")
    for event in tail_file(log_path):
        incident = detector.process(event)
        if incident:
            _handle_incident(incident)


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("replay", "watch"):
        print(__doc__)
        print("Usage: python main.py replay <log_path>")
        print("       python main.py watch  <log_path>")
        sys.exit(1)

    mode, path = sys.argv[1], sys.argv[2]
    if mode == "replay":
        run_replay(path)
    else:
        run_watch(path)
