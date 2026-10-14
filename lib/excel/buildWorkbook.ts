import { formatUtcDateTime } from "@/lib/date-format"
import ExcelJS from "exceljs"

export interface SubredditRow {
  Subreddit: string
  Total_Posts: number
  Avg_Upvotes_Per_Post: number
  Avg_Comments_Per_Post: number
  Median_Upvotes?: number
  Total_Upvotes?: number
  Total_Comments?: number
  Subreddit_Subscribers?: number
  Post_Frequency?: string
  WPI_Score?: number
  WPI_Rating?: string
  LastDateTimeUTC: string
}

export interface BuildWorkbookOptions {
  username: string
  inclMed?: number | boolean
  inclVote?: number | boolean
  inclComm?: number | boolean
  inclSubs?: number | boolean
  inclPER?: number | boolean
}

export async function buildWorkbook(
  rows: SubredditRow[],
  { username, inclMed = 0, inclVote = 0, inclComm = 0, inclSubs = 0, inclPER = 0 }: BuildWorkbookOptions
): Promise<{ buffer: Buffer; filename: string }> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Subreddit Analysis", {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", ySplit: 1 }],
  })

  const columns: Array<{ header: string; key: keyof SubredditRow | string; width: number }> = [
    { header: "Subreddit", key: "Subreddit", width: 25 },
    { header: "Total Posts", key: "Total_Posts", width: 14 },
    { header: "Avg Upvotes Per Post", key: "Avg_Upvotes_Per_Post", width: 20 },
    { header: "Avg Comments Per Post", key: "Avg_Comments_Per_Post", width: 22 },
    { header: "Post Frequency", key: "Post_Frequency", width: 20 },
  ]

  if (inclMed) columns.push({ header: "Median Upvotes", key: "Median_Upvotes", width: 18 })
  if (inclVote) columns.push({ header: "Total Upvotes", key: "Total_Upvotes", width: 18 })
  if (inclComm) columns.push({ header: "Total Comments", key: "Total_Comments", width: 18 })
  if (inclSubs) columns.push({ header: "Subreddit Subscribers", key: "Subreddit_Subscribers", width: 22 })
  if (inclPER) {
    columns.push({ header: "WPI Score", key: "WPI_Score", width: 14 })
    columns.push({ header: "WPI Rating", key: "WPI_Rating", width: 16 })
  }
  columns.push({ header: "Last Post Date (UTC)", key: "LastDateTimeUTC", width: 22 })

  worksheet.columns = columns as any
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } }

  rows.forEach((r) =>
    worksheet.addRow({
      ...r,
      LastDateTimeUTC: formatUtcDateTime(r.LastDateTimeUTC),
    })
  )

  const keyToIndex: Record<string, number> = {}
  worksheet.columns.forEach((c: any, i: number) => {
    if (c?.key) keyToIndex[c.key] = i + 1
  })
  const setColFmt = (key: string, fmt: string) => {
    const idx = keyToIndex[key]
    if (!idx) return
    worksheet.getColumn(idx).numFmt = fmt
  }

  setColFmt("Total_Posts", "0")
  setColFmt("Avg_Upvotes_Per_Post", "0")
  setColFmt("Avg_Comments_Per_Post", "0")
  setColFmt("Median_Upvotes", "0")
  setColFmt("Total_Upvotes", "#,##0")
  setColFmt("Total_Comments", "#,##0")
  setColFmt("Subreddit_Subscribers", "#,##0")
  setColFmt("WPI_Score", "0")

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const filename = `${username}_subreddit_analysis.xlsx`
  return { buffer, filename }
}
