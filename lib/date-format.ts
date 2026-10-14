type DateValue = string | number | Date | null | undefined
type DateOptions = { timeZone?: string }
type DateTimeOptions = DateOptions & { includeSeconds?: boolean }

const dateOnly = /^(?:\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/

/** Parse day-first display/export dates without JavaScript's month-first guess. */
export function parseDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "string") {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,]+(\d{2}):(\d{2})(?::(\d{2}))?(?: (UTC))?)?$/.exec(value.trim())
    if (match) {
      const [, day, month, year, hour = "00", minute = "00", second = "00", utc] = match
      const parts = [Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)] as const
      const inUtc = !!utc || !match[4]
      const date = inUtc ? new Date(Date.UTC(...parts)) : new Date(...parts)
      const actual = inUtc
        ? [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
        : [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
      return actual.every((part, index) => part === parts[index]) ? date : null
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value)
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
    }
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

/** Only presentation changes; API timestamps and sortable keys remain ISO. */
export function formatDate(value: DateValue, options: DateOptions = {}): string {
  const date = parseDate(value)
  if (!date) return "—"
  // Calendar-only values must not shift to the previous date in western time zones.
  const timeZone = typeof value === "string" && dateOnly.test(value) ? "UTC" : options.timeZone
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date)
}

export function formatDateTime(value: DateValue, options: DateTimeOptions = {}): string {
  const date = parseDate(value)
  if (!date) return "—"
  const timeZone = typeof value === "string" && dateOnly.test(value) ? "UTC" : options.timeZone
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", second: options.includeSeconds === false ? undefined : "2-digit",
    hourCycle: "h23", timeZone,
  }).format(date)
  return `${formatDate(value, { timeZone })} ${time}`
}

export function formatUtcDateTime(value: DateValue): string {
  return parseDate(value) ? `${formatDateTime(value, { timeZone: "UTC", includeSeconds: false })} UTC` : "—"
}
