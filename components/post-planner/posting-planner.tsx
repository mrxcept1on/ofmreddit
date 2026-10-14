"use client"

import { parseDate } from "@/lib/date-format"
import React, { useMemo, useState } from "react"
import OneDayPicker from "@/components/post-planner/one-day-picker"
import AutoPlan from "@/components/post-planner/auto-plan"
import HowItWorksModal from "@/components/post-planner/how-it-works"
import s from "@/styles/scraper.module.css"

type AxisDomain = ["auto" | number, "auto" | number]
type AverageMetricKey = "mean_upvotes_all" | "median_upvotes_all"
type Tier = "High" | "Medium" | "Low"

type PostData = {
  subreddit: string
  title?: string
  upvotes: number
  comments: number
  subscribers?: number | null
  post_date_utc: string | number | Date
}

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

const convertDate = (dateVal: string | number | Date): Date | null => {
  if (!dateVal) return null
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal
  if (typeof dateVal === "number" && Number.isFinite(dateVal)) return new Date(Math.round((dateVal - 25569) * 86400 * 1000))
  const d = parseDate(dateVal)
  return d
}

const getMedian = (arr: number[]): number => {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m]
}

const getQuartiles = (numbers: number[]) => {
  if (numbers.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0 }
  const sorted = [...numbers].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const median = getMedian(sorted)
  if (numbers.length < 4) return { min, q1: median, median, q3: median, max, iqr: 0 }
  const mid = Math.floor(sorted.length / 2)
  const q1List = sorted.slice(0, mid)
  const q3List = sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1)
  const q1 = getMedian(q1List)
  const q3 = getMedian(q3List)
  const iqr = Math.round(q3 - q1)
  return { min, q1, median, q3, max, iqr }
}

const analyzeSubredditData = (posts: PostData[]): SubredditAnalysisData[] => {
  const now = new Date()
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  const subredditMap = new Map<string, PostData[]>()
  posts.forEach(post => {
    if (!post.subreddit) return
    if (!subredditMap.has(post.subreddit)) subredditMap.set(post.subreddit, [])
    subredditMap.get(post.subreddit)!.push(post)
  })

  let processed = Array.from(subredditMap.entries()).map(([name, subPosts]) => {
    const postsWithDates = subPosts.map(p => ({ ...p, parsed_date: convertDate(p.post_date_utc) })).filter(p => p.parsed_date) as (PostData & { parsed_date: Date })[]
    if (postsWithDates.length === 0) return null

    const avg = (arr: { upvotes: number }[]) => (arr.length > 0 ? arr.reduce((s, p) => s + p.upvotes, 0) / arr.length : 0)
    const avg_upvotes_all = avg(postsWithDates)
    const allUpvotes = postsWithDates.map(p => p.upvotes)
    const quart = getQuartiles(allUpvotes)
    const maxSubscribers = postsWithDates.reduce((m, p) => Math.max(m, p.subscribers ?? 0), 0)
    const totalUpvotes = postsWithDates.reduce((s, p) => s + p.upvotes, 0)
    const totalComments = postsWithDates.reduce((s, p) => s + p.comments, 0)
    const averageComments = postsWithDates.length > 0 ? totalComments / postsWithDates.length : 0
    const lastPost = postsWithDates.sort((a, b) => b.parsed_date.getTime() - a.parsed_date.getTime())[0]
    const last_post_date_utc = lastPost.parsed_date
    const lastPostUTC = Date.UTC(last_post_date_utc.getUTCFullYear(), last_post_date_utc.getUTCMonth(), last_post_date_utc.getUTCDate())
    const days_since_last_post = Math.floor((nowUTC - lastPostUTC) / 86400000)

    return {
      subreddit: name,
      total_post_count: postsWithDates.length,
      total_upvotes: totalUpvotes,
      total_comments: totalComments,
      average_comments: Math.round(averageComments),
      avg_upvotes_all,
      members: maxSubscribers,
      min_all: quart.min,
      q1_all: quart.q1,
      q3_all: quart.q3,
      max_all: quart.max,
      last_post_date_utc,
      days_since_last_post,
      tier: null as Tier | null,
      mean_upvotes_all: Math.round(avg_upvotes_all || 0),
      median_upvotes_all: quart.median,
    }
  }).filter((d): d is Exclude<typeof d, null> => d !== null)

  const dataWithTierVal = processed.map(d => ({ ...d, tieringValue: d.avg_upvotes_all }))
  const sorted = [...dataWithTierVal].sort((a, b) => a.tieringValue - b.tieringValue)
  const dropIdx = Math.floor(sorted.length * 0.05)
  const subsToDrop = new Set(sorted.slice(0, dropIdx).map(d => d.subreddit))
  const highCut = sorted[Math.floor(sorted.length * 0.7)]?.tieringValue ?? 0
  const lowCut = sorted[Math.floor(sorted.length * 0.3)]?.tieringValue ?? 0

  return processed.map(d => {
    if (subsToDrop.has(d.subreddit)) return { ...d, tier: null }
    const val = d.avg_upvotes_all
    const tier: Tier = val >= highCut ? "High" : val >= lowCut ? "Medium" : "Low"
    return { ...d, tier }
  })
}

interface PostingPlannerProps {
  rawPosts: PostData[]
}

export default function PostingPlanner({ rawPosts }: PostingPlannerProps) {
  const [plannerMode, setPlannerMode] = useState<"picker" | "auto">("picker")
  const [isModalOpen, setIsModalOpen] = useState(false)

  const analyzedSubredditData = useMemo(() => analyzeSubredditData(rawPosts || []), [rawPosts])

  return (
    <div className={`min-h-screen bg-background ${s.bgPattern}`}>
      <div className="mx-auto max-w-7xl space-y-6 md:p-2">
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[color:var(--sidebar-primary)]/40 text-[color:var(--sidebar-primary)] hover:bg-[color:var(--sidebar-primary)]/10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              How it Works
            </button>
          </div>

          <div className="flex rounded-md bg-muted p-1 max-w-md mx-auto">
            <button
              onClick={() => setPlannerMode("picker")}
              className={`w-full py-2 text-sm rounded ${plannerMode === "picker" ? "bg-card text-foreground font-semibold shadow" : "text-muted-foreground"}`}
            >
              Next Day Plan Builder
            </button>
            <button
              onClick={() => setPlannerMode("auto")}
              className={`w-full py-2 text-sm rounded ${plannerMode === "auto" ? "bg-card text-foreground font-semibold shadow" : "text-muted-foreground"}`}
            >
              5 Day Set Plan
            </button>
          </div>
        </div>

        {plannerMode === "picker" ? (
          <OneDayPicker allSubredditData={analyzedSubredditData} />
        ) : (
          <AutoPlan allSubredditData={analyzedSubredditData} />
        )}

        <HowItWorksModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </div>
  )
}
