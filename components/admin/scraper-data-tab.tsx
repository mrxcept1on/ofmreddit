"use client"
import { formatDateTime } from "@/lib/date-format"
import { useEffect, useMemo, useState } from "react"

type Row = {
  user_id: number
  occurred_at: string
  meta: string
  email: string
  is_admin: boolean
  account_username: string | null
}

type Group = {
  id: number
  email: string
  role: "Admin" | "User"
  accountUsername: string | null
  latestUsername: string | null
  history: { username: string; at: string }[]
}

export function ScraperDataTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token")
      if (!token) return
      setLoading(true)
      try {
        const res = await fetch("/api/admin/feature-usage?feature=scraper", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error("failed")
        const data = await res.json()
        setRows(data.rows || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const groups: Group[] = useMemo(() => {
    const map = new Map<number, Group>()
    for (const r of rows) {
      let u1 = ""
      let u2 = ""
      try {
        const parsed = JSON.parse(r.meta || "{}")
        u1 = typeof parsed?.username === "string" ? parsed.username.trim() : ""
        u2 = typeof parsed?.username2 === "string" ? parsed.username2.trim() : ""
      } catch {}
      const usernames = [u1, u2].filter(Boolean)
      if (!map.has(r.user_id)) {
        map.set(r.user_id, {
          id: r.user_id,
          email: r.email,
          role: r.is_admin ? "Admin" : "User",
          accountUsername: r.account_username ?? null,
          latestUsername: usernames[0] || null,
          history: [],
        })
      }
      const g = map.get(r.user_id)!
      for (const un of usernames) g.history.push({ username: un, at: r.occurred_at })
    }
    const arr = Array.from(map.values())
    for (const g of arr) {
      const seen = new Set<string>()
      g.history = g.history.filter(h => {
        const k = h.username.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }
    return arr.sort((a, b) => a.email.localeCompare(b.email))
  }, [rows])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!groups.length) {
    return <div className="text-sm text-muted-foreground">No scraper data found.</div>
  }

  return (
    <div className="space-y-4">
      {groups.map(g => (
        <div key={g.id} className="rounded-2xl border p-4 bg-card">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <div className="font-medium">{g.email}</div>
              {g.accountUsername && (
                <div className="text-muted-foreground">({g.accountUsername})</div>
              )}
              <span className="text-xs px-3 py-2 rounded-md border">{g.role}</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-muted-foreground mb-2">Past username scrapes</div>
            <div className="flex flex-wrap gap-2">
              {g.history.length === 0 && <span className="text-sm text-muted-foreground">None</span>}
              {g.history.map((h, i) => (
                <span key={i} className="text-xs rounded-md border px-3 py-2" title={formatDateTime(h.at)}>
                  {h.username}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
