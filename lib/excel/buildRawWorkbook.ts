import { formatUtcDateTime } from "@/lib/date-format"
import ExcelJS from "exceljs"

export interface RawPostRow {
  Subreddit: string
  Upvotes: number
  Comments: number
  Subreddit_Subscribers?: number
  LastDate: Date | string
}

export async function buildRawWorkbook(
  rows: RawPostRow[],
  username: string,
  opts?: { inclSubs?: boolean | number }
): Promise<{ buffer: Buffer; filename: string }> {
  const inclSubs = !!opts?.inclSubs
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Raw Subreddit Data")

  const cols: any[] = [
    { header: "Subreddit", key: "Subreddit", width: 25 },
    { header: "Upvotes", key: "Upvotes", width: 12 },
    { header: "Comments", key: "Comments", width: 12 },
    { header: "Last Post Date (UTC)", key: "LastDate", width: 24 },
  ]

  if (inclSubs) {
    const insertAt = cols.findIndex(c => c.key === "LastDate")
    cols.splice(insertAt, 0, { header: "Subreddit Subscribers", key: "Subreddit_Subscribers", width: 20 })
  }

  worksheet.columns = cols as any
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } }

  rows.forEach(r =>
    worksheet.addRow({
      ...r,
      LastDate: formatUtcDateTime(r.LastDate),
    })
  )

  worksheet.getColumn("Upvotes").numFmt = "#,##0"
  worksheet.getColumn("Comments").numFmt = "#,##0"
  if (inclSubs) worksheet.getColumn("Subreddit_Subscribers").numFmt = "#,##0"

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const filename = `${username}_subreddit_rawdata.xlsx`
  return { buffer, filename }
}
