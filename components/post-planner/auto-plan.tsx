"use client"

import { formatDate } from "@/lib/date-format"
import React, { useEffect, useState } from "react"

type Tier = "High" | "Medium" | "Low"

type SubredditAnalysisData = {
  subreddit: string
  total_post_count: number
  total_upvotes: number
  total_comments: number
  average_comments: number
  avg_upvotes_all: number
  last_post_date_utc: Date | null
  days_since_last_post: number
  members: number
  mean_upvotes_all: number
  median_upvotes_all: number
  min_all: number
  q1_all: number
  q3_all: number
  max_all: number
  tier: Tier | null
}

type PlanSub = SubredditAnalysisData & { isTester?: boolean; dynamic_days_since: number; tier: Tier; strategicValue?: number }
type Plan = { day: number; date: Date; subreddits: PlanSub[] }[]

const dot = (t: Tier | null) => t === "High" ? "bg-emerald-500" : t === "Medium" ? "bg-amber-400" : t === "Low" ? "bg-rose-500" : "bg-muted-foreground"

const Tooltip: React.FC<{ text: React.ReactNode; children: React.ReactNode }> = ({ text, children }) => (
  <div className="relative inline-flex items-center group">
    {children}
    <div className="absolute bottom-full mb-2 w-80 bg-card text-xs rounded py-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 border border-border shadow-lg z-20">
      {text}
    </div>
  </div>
)

export default function AutoPlan({ allSubredditData }: { allSubredditData: SubredditAnalysisData[] }) {
  const [postsPerDay, setPostsPerDay] = useState(10)
  const [cooldownDays, setCooldownDays] = useState(2)
  const [priorityDays, setPriorityDays] = useState(5)
  const [bonusPerDay, setBonusPerDay] = useState(25)
  const [junkPostCount, setJunkPostCount] = useState(5)
  const [junkAvgUpvotes, setJunkAvgUpvotes] = useState(60)
  const [junkMembers, setJunkMembers] = useState(100000)

  const [planGenerated, setPlanGenerated] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [removed, setRemoved] = useState<Set<string>>(new Set())

  const generatePlan = () => {
    const junk = new Set(allSubredditData.filter(s => s.total_post_count > junkPostCount && s.avg_upvotes_all < junkAvgUpvotes && s.members < junkMembers).map(s => s.subreddit))
    const base = allSubredditData.filter(s => !junk.has(s.subreddit) && s.tier && !removed.has(s.subreddit))
    const sorted = [...base].sort((a, b) => b.avg_upvotes_all - a.avg_upvotes_all)
    const total = sorted.length
    const hi = new Set(sorted.slice(0, Math.floor(total * 0.3)).map(s => s.subreddit))
    const md = new Set(sorted.slice(Math.floor(total * 0.3), Math.floor(total * 0.7)).map(s => s.subreddit))

    const candidates: PlanSub[] = base.map(s => ({
      ...s,
      tier: hi.has(s.subreddit) ? "High" : md.has(s.subreddit) ? "Medium" : "Low",
      dynamic_days_since: s.days_since_last_post,
    }))

    const highCap = Math.ceil(hi.size / 5)
    const newPlan: Plan = []

    for (let d = 0; d < 5; d++) {
      const date = new Date()
      date.setDate(date.getDate() + d)

      candidates.forEach(c => { c.dynamic_days_since++ })
      const eligible = candidates.filter(c => c.dynamic_days_since >= cooldownDays + 1)

      const ranked = eligible.map(s => {
        let value = s.tier === "High" ? 1000 : s.tier === "Medium" ? 700 : 100
        if (s.dynamic_days_since >= priorityDays) value += 250 + ((s.dynamic_days_since - priorityDays) * bonusPerDay)
        return { ...s, strategicValue: value }
      }).sort((a, b) => (b.strategicValue || 0) - (a.strategicValue || 0))

      const H = ranked.filter(x => x.tier === "High")
      const M = ranked.filter(x => x.tier === "Medium")
      const L = ranked.filter(x => x.tier === "Low")

      const take = (list: PlanSub[], count: number, used: Set<string>) => {
        const out: PlanSub[] = []
        for (const s of list) {
          if (out.length >= count) break
          if (!used.has(s.subreddit)) {
            out.push(s)
            used.add(s.subreddit)
          }
        }
        return out
      }

      const today: PlanSub[] = []
      const used = new Set<string>()
      today.push(...take(H, 3, used))
      today.push(...take(M, 4, used))
      today.push(...take(L, 1, used))

      if (today.length < postsPerDay) {
        const rest = ranked.filter(s => !used.has(s.subreddit))
        let hiFilled = today.filter(x => x.tier === "High").length
        for (const s of rest) {
          if (today.length >= postsPerDay) break
          if (s.tier === "High") {
            if (hiFilled < highCap) {
              today.push(s); used.add(s.subreddit); hiFilled++
            }
          } else {
            today.push(s); used.add(s.subreddit)
          }
        }
      }

      while (today.length < postsPerDay) today.push({ subreddit: "Empty Slot" } as any)

      newPlan.push({ day: d + 1, date, subreddits: today.sort((a, b) => (b.strategicValue || 0) - (a.strategicValue || 0)) })
      used.forEach(name => {
        const ref = candidates.find(c => c.subreddit === name)
        if (ref) ref.dynamic_days_since = 0
      })
    }

    setPlan(newPlan)
  }

  const generate = () => { setPlanGenerated(true); generatePlan() }
  useEffect(() => { if (planGenerated) generatePlan() }, [postsPerDay, cooldownDays, priorityDays, bonusPerDay, junkPostCount, junkAvgUpvotes, junkMembers])

  const remove = (s: string) => setRemoved(prev => new Set(prev).add(s))
  const addBack = (s: string) => setRemoved(prev => { const n = new Set(prev); n.delete(s); return n })

  const fmtDate = formatDate

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-center">
          <div className="flex items-center gap-3">
            <label htmlFor="ppd" className="text-foreground/90">Posts per Day</label>
            <input id="ppd" type="number" value={postsPerDay} min={1} onChange={e => setPostsPerDay(Math.max(1, Number(e.target.value)))} className="w-24 bg-muted border border-border rounded-md p-1.5 text-center" />
          </div>
          <div className="flex items-center gap-3">
            <Tooltip text="Minimum full days to wait after posting before eligible again.">
              <label htmlFor="cool" className="text-foreground/90 flex items-center gap-1.5 cursor-help">Cooldown</label>
            </Tooltip>
            <input id="cool" type="number" value={cooldownDays} min={1} onChange={e => setCooldownDays(Math.max(1, Number(e.target.value)))} className="w-24 bg-muted border border-border rounded-md p-1.5 text-center" />
          </div>
          <div className="flex items-center gap-3">
            <Tooltip text="Subs past this window gain daily bonus to rise in priority.">
              <label htmlFor="prio" className="text-foreground/90 flex items-center gap-1.5 cursor-help">Priority Window</label>
            </Tooltip>
            <input id="prio" type="number" value={priorityDays} min={cooldownDays + 1} onChange={e => setPriorityDays(Math.max(cooldownDays + 1, Number(e.target.value)))} className="w-24 bg-muted border border-border rounded-md p-1.5 text-center" />
          </div>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Advanced: Junk Tier Settings</summary>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-3">
              <label htmlFor="jp" className="text-foreground/90">Min Posts &gt;</label>
              <input id="jp" type="number" value={junkPostCount} onChange={e => setJunkPostCount(Number(e.target.value))} className="w-24 bg-muted border border-border rounded-md p-1.5 text-center" />
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="ju" className="text-foreground/90">Avg Upvotes &lt;</label>
              <input id="ju" type="number" value={junkAvgUpvotes} onChange={e => setJunkAvgUpvotes(Number(e.target.value))} className="w-24 bg-muted border border-border rounded-md p-1.5 text-center" />
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="jm" className="text-foreground/90">Members &lt;</label>
              <input id="jm" type="number" value={junkMembers} onChange={e => setJunkMembers(Number(e.target.value))} className="w-28 bg-muted border border-border rounded-md p-1.5 text-center" />
            </div>
            <div className="flex items-center gap-3">
              <Tooltip text="Bonus points per day after Priority Window for ranking.">
                <label htmlFor="bp" className="text-foreground/90 flex items-center gap-1.5 cursor-help">Bonus/Day</label>
              </Tooltip>
              <input id="bp" type="number" value={bonusPerDay} onChange={e => setBonusPerDay(Number(e.target.value))} className="w-24 bg-muted border border-border rounded-md p-1.5 text-center" />
            </div>
          </div>
        </details>

        <div className="text-center pt-2">
          <button onClick={generate} className="px-5 py-2 rounded-lg bg-[color:var(--sidebar-primary)] text-white font-semibold hover:opacity-90">
            {planGenerated ? "Regenerate 5-Day Plan" : "Generate 5-Day Plan"}
          </button>
        </div>
        <div className="text-center pt-2 -mt-3 text-xs text-muted-foreground">
          Exclude any subreddit from the plan below and regenerate to refresh the plan considering the exclusions.
        </div>
      </div>

      {plan && (
        <>
          {removed.size > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h4 className="font-bold text-foreground mb-2">Excluded Subreddits</h4>
              <p className="text-sm text-muted-foreground mb-3">
                These subreddits are excluded. Click to add back, then regenerate to refresh the plan.
              </p>
              <div className="flex flex-wrap gap-2">
                {[...removed].sort().map(s => (
                  <button key={s} onClick={() => addBack(s)} className="text-xs px-2 py-1 rounded bg-rose-900/40 text-gray hover:bg-rose-600/40">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {plan.map(({ day, date, subreddits }) => (
              <div key={day} className="rounded-lg border border-border bg-card p-4 flex flex-col">
                <div className="mb-3 border-b border-border/60 pb-2">
                  <h3 className="text-lg font-bold">Day {day}</h3>
                  <p className="text-xs text-muted-foreground">{fmtDate(date)}</p>
                </div>
                <ul className="space-y-2 flex-1">
                  {subreddits.map((s, i) => {
                    if (s.subreddit === "Empty Slot") {
                      return (
                        <li key={i} className="text-muted-foreground italic bg-muted/40 p-2 rounded-md h-[52px] flex items-center">
                          Empty Slot
                        </li>
                      )
                    }

                    const isRemoved = removed.has(s.subreddit)

                    return (
                      <li
                        key={`${s.subreddit}-${i}`}
                        className={`group relative p-2 rounded-md text-foreground flex items-start gap-2 border transition-colors
                        ${isRemoved ? "bg-rose-500/20 border-rose-500/40" : "bg-muted/40 border-transparent"}
                      `}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${dot(s.tier ?? null)}`} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{s.subreddit}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{Math.round(s.avg_upvotes_all).toLocaleString()} upvotes</span>
                            <span className="text-muted-foreground/40">•</span>
                            <span>{s.dynamic_days_since} days ago</span>
                          </div>
                        </div>

                        <button
                          onClick={() => remove(s.subreddit)}
                          className={`absolute top-1/2 right-1 -translate-y-1/2 p-1.5 rounded-full bg-card text-muted-foreground transition-all
                          ${isRemoved ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white"}
                        `}
                          title={`Remove ${s.subreddit}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </li>
                    )
                  })}


                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
