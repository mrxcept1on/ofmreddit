const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const context = { exports: {}, Date, Intl, Buffer, require: name => {
    if (!(name in dependencies)) throw Error('Unexpected import ' + name)
    return dependencies[name]
  } }
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, context)
  return context.exports
}
const dates = load('lib/date-format.ts')

test('all dates are padded day/month/four-digit year, independently of browser locale', () => {
  assert.equal(dates.formatDate('2026-01-02'), '02/01/2026')
  assert.equal(dates.formatDate('2026-10-13'), '13/10/2026')
  assert.equal(dates.formatDate('02/01/2026'), '02/01/2026')
  for (const timeZone of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
    assert.equal(dates.formatDate('2026-01-02', { timeZone }), '02/01/2026')
  }
})

test('timestamps preserve local/explicit time zones and times, with unambiguous numeric dates', () => {
  const value = '2026-10-12T20:04:05Z'
  assert.equal(dates.formatDateTime(value, { timeZone: 'UTC' }), '12/10/2026 20:04:05')
  assert.equal(dates.formatDateTime(value, { timeZone: 'Asia/Manila' }), '13/10/2026 04:04:05')
  assert.equal(dates.formatDateTime(value, { timeZone: 'America/Los_Angeles' }), '12/10/2026 13:04:05')
  assert.equal(dates.formatDateTime('2026-01-02', { timeZone: 'America/Los_Angeles' }), '02/01/2026 00:00:00')
  assert.equal(dates.formatUtcDateTime(value), '12/10/2026 20:04 UTC')
})

test('missing and invalid values do not invent dates; leap days validate strictly', () => {
  for (const value of [null, undefined, '', 'bad date', '31/02/2026', '2026-02-30', new Date(NaN)]) {
    assert.equal(dates.parseDate(value), null)
    assert.equal(dates.formatDate(value), '—')
    assert.equal(dates.formatDateTime(value), '—')
    assert.equal(dates.formatUtcDateTime(value), '—')
  }
  assert.equal(dates.formatDate('2028-02-29'), '29/02/2028')
  assert.equal(dates.parseDate('29/02/2026'), null)
  assert.equal(dates.parseDate('13/10/2026 25:04 UTC'), null)
})

test('day-first Excel export dates round-trip into planner dates without month/day reversal', () => {
  for (const value of ['2026-01-02T04:05:00Z', '2026-10-13T20:04:00Z']) {
    const exported = dates.formatUtcDateTime(value)
    assert.equal(dates.parseDate(exported).toISOString(), value.replace('Z', '.000Z'))
  }
  assert.equal(dates.parseDate('02/01/2026 04:05 UTC').toISOString(), '2026-01-02T04:05:00.000Z')
  assert.equal(dates.parseDate('13/10/2026').toISOString(), '2026-10-13T00:00:00.000Z')
})

test('both real Excel exports contain day-first dates with explicit UTC and remain valid workbooks', async () => {
  const ExcelJS = require('exceljs')
  const dependencies = { exceljs: ExcelJS, '@/lib/date-format': dates }
  const raw = load('lib/excel/buildRawWorkbook.ts', dependencies)
  const analysis = load('lib/excel/buildWorkbook.ts', dependencies)
  for (const result of [
    await raw.buildRawWorkbook([{ Subreddit: 'fixture', Upvotes: 42, Comments: 2, LastDate: '2026-01-02T04:05:00Z' }], 'fixture'),
    await analysis.buildWorkbook([{ Subreddit: 'fixture', Total_Posts: 1, Avg_Upvotes_Per_Post: 42, Avg_Comments_Per_Post: 2, LastDateTimeUTC: '2026-01-02T04:05:00Z' }], { username: 'fixture' }),
  ]) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(result.buffer)
    const values = workbook.worksheets[0].getRow(2).values
    assert.ok(values.includes('02/01/2026 04:05 UTC'))
    assert.ok(values.includes('fixture'))
  }
})

test('date-bearing UI uses centralized formatting rather than implicit locale defaults', () => {
  for (const file of [
    'components/admin/crypto-payments-tab.tsx', 'components/admin/copied-captions-tab.tsx',
    'components/admin/pending-subreddits-tab.tsx', 'components/admin/scraper-data-tab.tsx',
    'components/admin/user-row.tsx', 'components/admin/visits-tab.tsx', 'components/scraper/form.tsx',
    'components/scraper/scraper.tsx', 'components/scraper/line-chart.tsx', 'components/subscription/tiers.tsx',
    'components/post-planner/auto-plan.tsx', 'app/caption-generator/page.tsx', 'app/api/export-pdf/route.ts',
  ]) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /@\/lib\/date-format/, file)
    assert.doesNotMatch(source, /toLocaleDateString|new Date\([^\n]*?\.toLocaleString\(/, file)
  }
  assert.match(fs.readFileSync('components/post-planner/posting-planner.tsx', 'utf8'), /parseDate\(dateVal\)/)
})
