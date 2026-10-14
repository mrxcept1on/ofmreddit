"use client"

import { formatDate } from "@/lib/date-format"
import React from "react"
import {
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Label,
} from "recharts"

export type TimeSeriesRow = { date: string; [series: string]: number | string | null | undefined }

interface Props {
  data: TimeSeriesRow[]
  seriesKeys: string[]
  metricLabel: string
  domain: [number, number]
}

const TEAL = "rgb(20,184,166)"

function fmtDate(value: string) {
  const day = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value
  return formatDate(day, { timeZone: "UTC" })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-md border border-border bg-card/90 p-3 shadow-lg">
      <p className="font-semibold text-foreground">{fmtDate(label)}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {payload
          .slice()
          .sort((a: any, b: any) => (b?.value ?? 0) - (a?.value ?? 0))
          .map((pld: any, i: number) => (
            <li key={i} style={{ color: pld?.color ?? "inherit" }}>
              {`${pld.name}: ${Number(pld.value ?? 0).toLocaleString()}`}
            </li>
          ))}
      </ul>
    </div>
  )
}

export default function PerformanceLineChart({ data, seriesKeys, metricLabel, domain }: Props) {
  const cs = getComputedStyle(document.documentElement)
  const tickColor = cs.getPropertyValue("--muted-foreground")?.trim() || "#6b7280"
  const gridStrokeColor = "rgba(127,127,127,0.15)"
  const primary = cs.getPropertyValue("--sidebar-primary")?.trim() || "#4F46E5"

  const colors: Record<string, string> = {}
  if (seriesKeys[0]) colors[seriesKeys[0]] = primary
  if (seriesKeys[1]) colors[seriesKeys[1]] = TEAL

  const [min, max] = domain
  const paddedDomain: [number, number] = [
    min,
    Math.ceil((max || 10) * 1.05),
  ]

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RLineChart data={data} margin={{ top: 6, right: 24, left: 40, bottom: 6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStrokeColor} />
        <XAxis dataKey="date" tick={{ fill: tickColor }} stroke={tickColor} tickFormatter={fmtDate} />
        <YAxis
          tick={{ fill: tickColor }}
          stroke={tickColor}
          tickFormatter={(tick) => Number(tick).toLocaleString()}
          domain={paddedDomain}
          allowDataOverflow
        >
          <Label
            value={metricLabel}
            angle={-90}
            position="insideLeft"
            style={{ textAnchor: "middle", fill: tickColor }}
          />
        </YAxis>
        <Tooltip content={<CustomTooltip />} />
        <Legend iconSize={10} />
        {seriesKeys.map((k) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            name={k}
            stroke={colors[k] || primary}
            strokeWidth={2}
            dot={{ r: 2, stroke: colors[k] || primary, fill: colors[k] || primary }}
            activeDot={{ r: 4, stroke: colors[k] || primary, fill: colors[k] || primary }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </RLineChart>
    </ResponsiveContainer>
  )
}
