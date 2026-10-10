"""
Turns a structured Incident into a plain-language explanation.
"""
import os
import requests
from detector import Incident

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-sonnet-4-5"


def _template_explanation(incident: Incident) -> str:
    users = ", ".join(incident.usernames_tried[:4])
    if len(incident.usernames_tried) > 4:
        users += f", +{len(incident.usernames_tried) - 4} more"
    return (
        f"Possible SSH brute-force attack: {incident.attempt_count} failed login "
        f"attempts from {incident.source_ip} in {incident.window_minutes} minutes "
        f"(usernames tried: {users}). Severity: {incident.severity}. "
        f"Recommended action: block {incident.source_ip} at the firewall and "
        f"confirm none of the attempted usernames have weak passwords."
    )


def _llm_explanation(incident: Incident, api_key: str) -> str:
    prompt = (
        "You are a SOC assistant. Explain this detected security event to a "
        "non-technical server administrator in 2-3 plain-language sentences. "
        "State what happened, how serious it is, and one concrete recommended "
        "action. Do not invent any detail not given below.\n\n"
        f"Source IP: {incident.source_ip}\n"
        f"Failed login attempts: {incident.attempt_count}\n"
        f"Time window: {incident.window_minutes} minutes\n"
        f"First seen: {incident.first_seen.isoformat()}\n"
        f"Last seen: {incident.last_seen.isoformat()}\n"
        f"Usernames attempted: {', '.join(incident.usernames_tried)}\n"
        f"Severity: {incident.severity}\n"
    )
    response = requests.post(
        ANTHROPIC_API_URL,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": ANTHROPIC_MODEL,
            "max_tokens": 200,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    return "".join(block.get("text", "") for block in data.get("content", []))


def explain(incident: Incident) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _template_explanation(incident)
    try:
        return _llm_explanation(incident, api_key)
    except Exception as exc:
        fallback = _template_explanation(incident)
        return f"{fallback}\n[Note: AI explanation unavailable ({exc}); showing template summary.]"
