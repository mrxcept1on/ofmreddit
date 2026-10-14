import { query } from "@/lib/db"

export type BanDetectionCounts = {
  today: number
  last7Days: number
  last30Days: number
  total: number
  asOf: string
  todayStart: string
  weekStart: string
  monthStart: string
  timezone: "UTC"
}

export async function getBanDetectionCounts(now = new Date()): Promise<BanDetectionCounts> {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const week = new Date(now.getTime() - 7 * 86400_000)
  const month = new Date(now.getTime() - 30 * 86400_000)
  // Completion events are written only after the Sheet's archived status is verified.
  // Count unique names, not retries, non-ban archives or repeated ban episodes.
  const rows = await query<Record<"today" | "last7Days" | "last30Days" | "total", number | string>>(`
    SELECT COUNT(DISTINCT CASE WHEN created_at >= FROM_UNIXTIME(?) THEN LOWER(subreddit_name) END) AS today,
           COUNT(DISTINCT CASE WHEN created_at >= FROM_UNIXTIME(?) THEN LOWER(subreddit_name) END) AS last7Days,
           COUNT(DISTINCT CASE WHEN created_at >= FROM_UNIXTIME(?) THEN LOWER(subreddit_name) END) AS last30Days,
           COUNT(DISTINCT LOWER(subreddit_name)) AS total
      FROM subreddit_maintenance_events
     WHERE action = 'banned_removed' AND created_at <= FROM_UNIXTIME(?)`,
    [today.getTime() / 1000, week.getTime() / 1000, month.getTime() / 1000, now.getTime() / 1000])
  const row = rows[0]
  if (!row || ![row.today, row.last7Days, row.last30Days, row.total].every(value =>
    (typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value)))
    && Number.isSafeInteger(Number(value)) && Number(value) >= 0)) {
    throw new Error("Invalid ban detection counts")
  }
  if (Number(row.today) > Number(row.last7Days) || Number(row.last7Days) > Number(row.last30Days)
    || Number(row.last30Days) > Number(row.total)) throw new Error("Inconsistent ban removal counts")
  return { today: Number(row.today), last7Days: Number(row.last7Days), last30Days: Number(row.last30Days), total: Number(row.total),
    asOf: now.toISOString(), todayStart: today.toISOString(), weekStart: week.toISOString(),
    monthStart: month.toISOString(), timezone: "UTC" }
}
