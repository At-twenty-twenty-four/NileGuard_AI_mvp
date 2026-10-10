"""
FastAPI backend so the Next.js dashboard can read incidents.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env.local")

import storage

app = FastAPI(title="NileGuard AI API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/incidents")
def get_incidents(view: str = "active"):
    groups = storage.grouped_incidents(resolved=(view == "resolved"))
    return {
        "incidents": groups,
        "counts": storage.summary_counts(),
    }


@app.post("/api/incidents/{source_ip}/acknowledge")
def acknowledge(source_ip: str):
    updated = storage.resolve_ip(source_ip)
    return {"ok": True, "resolved_count": updated}
