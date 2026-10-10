'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  Filter,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Terminal,
  UserRound,
  Zap,
} from 'lucide-react'

type ApiIncident = {
  source_ip: string
  occurrences: number
  max_attempts: number
  severity: 'critical' | 'high' | 'medium'
  last_seen: string | null
  explanation: string
  usernames_tried: string[]
  latest_id: number
}

type Counts = {
  active_ips: number
  total_detections: number
  critical_or_high: number
  resolved_ips: number
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

const severityStyles = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
  high: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  medium: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
}

function SeverityBadge({ severity }: { severity: ApiIncident['severity'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${severityStyles[severity]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {severity}
    </span>
  )
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hr ago`
    return d.toLocaleString()
  } catch {
    return iso
  }
}

export default function Dashboard({ operatorName }: { operatorName: string }) {
  const [tab, setTab] = useState<'active' | 'resolved'>('active')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [incidents, setIncidents] = useState<ApiIncident[]>([])
  const [counts, setCounts] = useState<Counts>({
    active_ips: 0,
    total_detections: 0,
    critical_or_high: 0,
    resolved_ips: 0,
  })
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  const fetchIncidents = useCallback(async (view: 'active' | 'resolved') => {
    try {
      setError(null)
      const res = await fetch(`${API_BASE}/api/incidents?view=${view}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      setIncidents(data.incidents || [])
      setCounts(data.counts || counts)
      setLastRefresh(new Date())
    } catch (err) {
      console.error(err)
      setError('Could not reach detection API. Is the backend running on :8000?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchIncidents(tab)
    const id = setInterval(() => fetchIncidents(tab), 12000) // poll every 12s
    return () => clearInterval(id)
  }, [tab, fetchIncidents])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return incidents
    return incidents.filter(
      (i) =>
        i.source_ip.includes(q) ||
        i.usernames_tried.some((u) => u.toLowerCase().includes(q)) ||
        (i.explanation || '').toLowerCase().includes(q)
    )
  }, [incidents, search])

  async function copyBlockCommand(ip: string) {
    await navigator.clipboard?.writeText(`sudo iptables -A INPUT -s ${ip} -j DROP`)
    setCopied(ip)
    window.setTimeout(() => setCopied(null), 1800)
  }

  async function acknowledge(ip: string) {
    try {
      const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(ip)}/acknowledge`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Acknowledge failed')
      // Refresh both views
      await fetchIncidents(tab)
    } catch (err) {
      console.error(err)
      setError('Failed to acknowledge incident')
    }
  }

  return (
    <main className="min-h-screen bg-[#080d12] text-slate-100">
      <header className="border-b border-white/[0.07] bg-[#0b1117]/95">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-5 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              <Shield size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-wide text-white">
                  NileGuard <span className="text-cyan-300">AI</span>
                </h1>
                <span className="rounded border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  Live
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Security operations center <span className="text-slate-700">/</span> SSH protection
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hidden items-center gap-2 sm:flex">
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />{' '}
              Monitoring active
            </span>
            <button className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white" aria-label="Help">
              <CircleHelp size={16} />
            </button>
            <button className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white" aria-label="More options">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-6 py-7 lg:px-10">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-300/80">
              Threat overview
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Good evening, {operatorName || 'operator'}.
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Here&apos;s what&apos;s happening across your protected hosts.
            </p>
          </div>
          <button
            onClick={() => fetchIncidents(tab)}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.07]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh data{' '}
            <span className="text-slate-600">{formatTime(lastRefresh.toISOString())}</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Metrics */}
        <section aria-label="Security metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Critical / High',
              value: counts.critical_or_high,
              icon: ShieldAlert,
              tone: 'red',
              note: counts.critical_or_high ? 'Requires attention' : 'No critical threats',
            },
            {
              label: 'Active source IPs',
              value: counts.active_ips,
              icon: Globe2,
              tone: 'cyan',
              note: 'Currently under watch',
            },
            {
              label: 'Total detections',
              value: counts.total_detections,
              icon: Zap,
              tone: 'amber',
              note: 'All time (active)',
            },
            {
              label: 'Resolved incidents',
              value: counts.resolved_ips,
              icon: CheckCircle2,
              tone: 'emerald',
              note: 'Acknowledged',
            },
          ].map((metric) => {
            const Icon = metric.icon
            return (
              <div
                key={metric.label}
                className="group rounded-xl border border-white/[0.08] bg-[#0d151d] p-4 transition hover:border-white/[0.14]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                      {metric.value}
                    </p>
                  </div>
                  <div
                    className={`rounded-lg p-2 ${
                      metric.tone === 'red'
                        ? 'bg-red-400/10 text-red-300'
                        : metric.tone === 'cyan'
                          ? 'bg-cyan-400/10 text-cyan-300'
                          : metric.tone === 'amber'
                            ? 'bg-amber-400/10 text-amber-300'
                            : 'bg-emerald-400/10 text-emerald-300'
                    }`}
                  >
                    <Icon size={17} />
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-600">{metric.note}</p>
              </div>
            )
          })}
        </section>

        {/* Detections table */}
        <section className="mt-8 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d151d]">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-white">Detections</h3>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  {filtered.length} visible
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Review and respond to suspicious activity.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search IP, username..."
                  className="w-full rounded-lg border border-white/10 bg-black/10 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-400/40 sm:w-56"
                />
              </div>
              <button className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white" aria-label="Filter">
                <Filter size={15} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-6 border-b border-white/[0.07] px-4">
            <button
              onClick={() => setTab('active')}
              className={`relative py-3 text-xs font-medium transition ${
                tab === 'active' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Active{' '}
              <span className="ml-1.5 rounded-full bg-cyan-400/10 px-1.5 py-0.5 text-[10px]">
                {counts.active_ips}
              </span>
              {tab === 'active' && <span className="absolute inset-x-0 bottom-0 h-px bg-cyan-300" />}
            </button>
            <button
              onClick={() => setTab('resolved')}
              className={`relative py-3 text-xs font-medium transition ${
                tab === 'resolved' ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Resolved{' '}
              <span className="ml-1.5 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px]">
                {counts.resolved_ips}
              </span>
              {tab === 'resolved' && <span className="absolute inset-x-0 bottom-0 h-px bg-cyan-300" />}
            </button>
          </div>

          {/* Header row */}
          <div className="hidden grid-cols-[120px_170px_80px_1fr_135px_230px] gap-4 border-b border-white/[0.06] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600 lg:grid">
            <span>Severity</span>
            <span>Source IP</span>
            <span>Attempts</span>
            <span>What happened</span>
            <span>Last seen</span>
            <span className="text-right">Actions</span>
          </div>

          <div>
            {loading && filtered.length === 0 && (
              <div className="py-16 text-center text-sm text-slate-500">Loading detections…</div>
            )}

            {filtered.map((incident) => (
              <article
                key={incident.source_ip}
                className={`border-b border-white/[0.06] px-4 py-4 transition last:border-0 hover:bg-white/[0.02] lg:grid lg:grid-cols-[120px_170px_80px_1fr_135px_230px] lg:items-center lg:gap-4 lg:px-5 ${
                  selected === incident.source_ip ? 'bg-cyan-400/[0.03]' : ''
                }`}
              >
                <div className="flex items-center justify-between lg:block">
                  <SeverityBadge severity={incident.severity} />
                  <span className="text-[11px] text-slate-600 lg:hidden">
                    {formatTime(incident.last_seen)}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 lg:mt-0">
                  <span className="font-mono text-sm text-slate-200">{incident.source_ip}</span>
                  <button
                    onClick={() => copyBlockCommand(incident.source_ip)}
                    className="text-slate-600 transition hover:text-cyan-300"
                    aria-label={`Copy block command for ${incident.source_ip}`}
                  >
                    {copied === incident.source_ip ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  {incident.occurrences > 1 && (
                    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-500">
                      ×{incident.occurrences}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400 lg:mt-0">
                  <span className="font-semibold text-slate-200">{incident.max_attempts}</span>
                  <span className="text-slate-600">attempts</span>
                </div>

                <div className="mt-3 lg:mt-0">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Terminal size={13} className="text-slate-600" /> SSH{' '}
                    <span className="text-slate-700">·</span>{' '}
                    <span className="truncate">{incident.usernames_tried.join(', ')}</span>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                    {incident.explanation}
                  </p>
                </div>

                <div className="mt-3 text-xs text-slate-500 lg:mt-0">
                  {formatTime(incident.last_seen)}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 lg:mt-0 lg:justify-end">
                  <button
                    onClick={() =>
                      setSelected(selected === incident.source_ip ? null : incident.source_ip)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition hover:border-cyan-400/30 hover:text-cyan-300"
                  >
                    {selected === incident.source_ip ? 'Hide details' : 'Details'}{' '}
                    <ChevronDown
                      size={13}
                      className={selected === incident.source_ip ? 'rotate-180' : ''}
                    />
                  </button>

                  {tab === 'active' && (
                    <button
                      onClick={() => acknowledge(incident.source_ip)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-200 transition hover:bg-cyan-400/20"
                    >
                      <LockKeyhole size={13} /> Acknowledge
                    </button>
                  )}
                </div>

                {selected === incident.source_ip && (
                  <div className="col-span-full mt-4 grid gap-3 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.03] p-4 text-xs text-slate-400 sm:grid-cols-3">
                    <div>
                      <span className="text-slate-600">Recommended action</span>
                      <p className="mt-1 text-slate-300">
                        Block {incident.source_ip} at the firewall and rotate exposed credentials.
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Usernames tried</span>
                      <p className="mt-1 font-mono text-slate-300">
                        {incident.usernames_tried.join(', ')}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-600">Block command</span>
                      <p className="mt-1 font-mono text-[11px] text-cyan-300">
                        sudo iptables -A INPUT -s {incident.source_ip} -j DROP
                      </p>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <CheckCircle2 className="text-emerald-400" size={28} />
              <p className="text-sm font-medium text-slate-300">No matching detections</p>
              <p className="text-xs text-slate-600">
                Try changing your search or switching tabs.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-5 py-3 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {filtered.length} of {incidents.length} detections
            </span>
            <span className="flex items-center gap-1.5">
              <Activity size={13} className="text-emerald-400" /> Rules engine healthy{' '}
              <span className="text-slate-700">·</span> Auto-refresh 12s
            </span>
          </div>
        </section>

        {/* Bottom cards */}
        <section className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-[#0d151d] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Server size={15} className="text-cyan-300" /> Protected hosts
              </div>
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">1</p>
            <p className="mt-1 text-[11px] text-slate-600">Default host reporting</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0d151d] p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <UserRound size={15} className="text-violet-300" /> Accounts monitored
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">—</p>
            <p className="mt-1 text-[11px] text-slate-600">Coming soon</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-cyan-400/[0.1] to-transparent p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-cyan-200">
              <AlertTriangle size={15} /> Protection recommendation
            </div>
            <p className="mt-2 text-sm font-medium text-white">Enable adaptive lockouts</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Reduce repeated attacks automatically with a 15-minute progressive ban.
            </p>
          </div>
        </section>
      </div>

      <footer className="mx-auto flex max-w-[1500px] items-center justify-between px-6 pb-7 pt-3 text-[10px] text-slate-700 lg:px-10">
        <span>NileGuard AI · Secure by default</span>
        <span className="flex items-center gap-1.5">
          <LayoutDashboard size={11} /> v2.4.1 · Live API
        </span>
      </footer>
    </main>
  )
}
