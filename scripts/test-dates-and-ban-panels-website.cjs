// Client-rendering regression with explicitly intercepted fixtures; no production writes.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const puppeteer = require('puppeteer')

async function testDatesAndBanPanelsWebsite({ url, output = 'output/date-ban-website' }) {
  const origin = new URL(url).origin, destination = path.resolve(output)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  const report = { checkedAt: new Date().toISOString(), fixtureResponses: true, checks: {} }
  let browser, page, counts = { today: 3, last7Days: 9, last30Days: 21, total: 51, timezone: 'UTC' }
  const at = '2026-01-02T04:05:06Z', later = '2026-01-03T04:05:06Z'
  const user = { id: 7, email: 'fixture@example.test', username: 'fixture', telegram_username: 'fixture',
    is_admin: false, email_verified: true, created_at: at, last_active: later, tier_name: 'Pro',
    spa_uses: 2, checker_uses: 1, banned_id: null, custom_subreddit_checker_limit: null }
  const fixtures = {
    '/api/admin/prompts': { prompts: [] }, '/api/admin/users': { users: [user] },
    '/api/admin/copied-captions': { copiedCaptions: [{ id: 1, caption_text: 'Fixture caption', copied_at: at, post_name: 'Fixture', user_email: user.email }] },
    '/api/admin/crypto-payments': { payments: [
      { id: 'paid', username: 'fixture', email: user.email, tier_name: 'Pro', duration_days: 30,
        expected_amount: '30.05777788', coin: 'USDT', network: 'BSC', status: 'paid', tx_id: 'fixture_transaction', created_at: at, paid_at: later, expires_at: later },
      { id: 'expired', username: 'fixture', email: user.email, tier_name: 'Test', duration_days: 10,
        expected_amount: '18.22321700', coin: 'USDT', network: 'BSC', status: 'expired', created_at: at, paid_at: null, expires_at: later },
    ] },
    '/api/admin/pending': { subreddits: [{ id: 1, subreddit_name: 'fixture', subscribers: 123456, niche_tags: 'general',
      discovery_json: JSON.stringify({ top1_weekly: 800, latest_post_utc: Date.parse(at) / 1000 }), submitted_by: 'Fixture' }],
      availability: [{ subreddit_name: 'stale_fixture', state: 'suspect', dead_checks: 1, last_evidence: 'Fixture evidence', last_checked_at: at }] },
    '/api/admin/visits': { totalVisits: 4, visitsToday: 1, uniqueVisitorsToday: 1, topPages: [],
      visitsByDay: [{ date: '2026-01-02', count: 4 }], recentVisits: [{ id: 1, page_path: '/fixture',
        user_agent: 'Fixture', ip_address: '127.0.0.1', visited_at: at, user_id: 7, email: user.email, telegram_username: 'fixture' }] },
    '/api/admin/feature-usage': { rows: [{ user_id: 7, occurred_at: at, meta: JSON.stringify({ username: 'fixture_creator' }),
      email: user.email, is_admin: false, account_username: 'fixture' }] },
  }
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
    page = await browser.newPage()
    await page.emulateTimezone('Asia/Manila')
    await page.setViewport({ width: 1440, height: 1050 })
    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('token', 'client-rendering-fixture')
      localStorage.setItem('user', JSON.stringify({ isAdmin: true, hasTelegramLinked: true }))
    })
    await page.setRequestInterception(true)
    page.on('request', request => {
      const requested = new URL(request.url())
      if (requested.origin === origin && requested.pathname.startsWith('/api/')) {
        const body = requested.pathname === '/api/reddit-database' ? {
          mainSheet: { title: 'Fixture', headers: ['Subreddit Name', 'Total Members', 'Hot 1 (Weekly)'], rows: [['fixture', '123456', '800']] },
          rowHealth: {}, freePreview: false, banCounts: counts,
        } : fixtures[requested.pathname] || { success: true, tags: ['general'] }
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
      }
      return request.continue()
    })
    await page.goto(origin + '/reddit-database', { waitUntil: 'networkidle2' })
    for (const [id, value] of [['day', 3], ['week', 9], ['month', 21], ['total', 51]]) {
      await page.waitForSelector(`[data-testid="banned-${id}"]`)
      assert.equal(await page.$eval(`[data-testid="banned-${id}"]`, node => node.textContent.trim()), String(value))
    }
    const section = 'section[aria-label="Banned subreddits detected and removed"]'
    const text = await page.$eval(section, node => node.textContent)
    assert.match(text, /Today/); assert.match(text, /7 days/); assert.match(text, /One month/); assert.match(text, /Last 30 days/); assert.match(text, /Total/)
    assert.equal((text.match(/Banned detected and removed/g) || []).length, 4)
    assert.equal(await page.$eval(section + ' > div', node => getComputedStyle(node).gridTemplateColumns.split(' ').length), 4)
    await page.screenshot({ path: destination + '-panels-desktop.png' })
    report.checks.fourDesktopPanels = true
    await page.type('#search', 'no_match_fixture')
    assert.equal(await page.$eval('[data-testid="banned-total"]', node => node.textContent.trim()), '51')
    report.checks.globalCountsUnaffectedByFilters = true
    await page.setViewport({ width: 390, height: 844 })
    assert.ok(await page.$$eval(section + ' > div > div', nodes => nodes.every(node => {
      const rect = node.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth
    })))
    await page.screenshot({ path: destination + '-panels-mobile.png' })
    report.checks.mobilePanelsFit = true
    counts = null
    await page.reload({ waitUntil: 'networkidle2' })
    for (const id of ['day', 'week', 'month', 'total']) assert.equal(await page.$eval(`[data-testid="banned-${id}"]`, node => node.textContent.trim()), 'Unavailable')
    report.checks.allFourUnavailableWithoutFakeZeros = true
    await page.setViewport({ width: 1440, height: 1050 })
    await page.goto(origin + '/admin', { waitUntil: 'networkidle2' })
    const tab = async name => {
      report.stage = 'Admin tab: ' + name
      await page.waitForSelector('[role="tab"]')
      for (const button of await page.$$('[role="tab"]')) {
        if (await button.evaluate(node => node.textContent.trim()) === name) {
          await button.click()
          await page.waitForFunction(name => Array.from(document.querySelectorAll('[role="tab"]')).some(node => node.textContent.trim() === name && node.getAttribute('aria-selected') === 'true'), {}, name)
          return
        }
      }
      throw Error('Missing tab ' + name)
    }
    const expectText = async text => page.waitForFunction(text => document.querySelector('[role="tabpanel"][data-state="active"]')?.textContent.includes(text), {}, text)
    await tab('Payments'); await expectText('02/01/2026 12:05:06'); await expectText('03/01/2026 12:05:06')
    await expectText('30.05777788 USDT'); await expectText('paid'); await expectText('expired')
    await page.screenshot({ path: destination + '-payments.png' })
    report.checks.paymentOpenedPaidAndExpiryDates = true
    await tab('Users'); await expectText('02/01/2026'); await expectText('03/01/2026')
    report.checks.userCreatedAndActiveDates = true
    await tab('Copied Captions'); await expectText('02/01/2026 12:05:06')
    report.checks.copiedCaptionDates = true
    await tab('Subreddit Review'); await expectText('02/01/2026'); await expectText('02/01/2026 12:05:06')
    report.checks.discoveryAndAvailabilityDates = true
    await tab('Website Visits'); await expectText('02/01/2026 12:05:06')
    report.checks.visitDates = true
    await tab('Scraper Data')
    await page.waitForSelector('[title="02/01/2026 12:05:06"]')
    report.checks.scraperLogDates = true
    report.passed = Object.values(report.checks).every(Boolean)
  } catch (error) {
    report.failure = error.message; report.passed = false
    if (page) await page.screenshot({ path: destination + '-failure.png' }).catch(() => {})
  } finally {
    if (browser) await browser.close()
    fs.writeFileSync(destination + '.json', JSON.stringify(report, null, 2))
  }
  return report
}
module.exports = { testDatesAndBanPanelsWebsite }
if (require.main === module) testDatesAndBanPanelsWebsite({ url: process.env.DATABASE_WEBSITE_URL || 'http://localhost:3012' })
  .then(report => { console.log(JSON.stringify(report)); if (!report.passed) process.exitCode = 1 })
  .catch(error => { console.error(error.message); process.exitCode = 1 })
