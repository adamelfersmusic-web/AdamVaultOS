// Pages view must render an .mdx note as compiled MDX (read-only), NOT dump
// the raw source (export const / {expressions}) into the TipTap editor.
// Regression guard for the "pages view shows raw code" bug.
import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'
const NOTE = '_priority/escensus/_mc-test'

const SOURCE = `## Board

export const DONE = [{ ok: true }, { ok: false }]

You've cleared {DONE.filter((d) => d.ok).length} of {DONE.length}.

A live <Term id="context-window">context window</Term> term.
`

test.beforeEach(async ({ page }) => {
  await page.request.post(`${MOCK}/__test/reset`)
})

test('pages view renders an .mdx note as compiled MDX, not raw source', async ({ page }) => {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: NOTE, extension: 'mdx', content: SOURCE, tags: [], metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)

  await page.addInitScript(
    ([key, url, token]: [string, string, string]) => {
      localStorage.setItem(
        key,
        JSON.stringify({ vaultUrl: url, mode: 'token', token: { accessToken: token } }),
      )
    },
    [SESSION_KEY, MOCK, TOKEN] as [string, string, string],
  )

  await page.goto(`http://127.0.0.1:4173/#/pages/${encodeURIComponent(NOTE)}`)

  // The MDX body mounts read-only; the live <Term> compiles.
  const body = page.locator('.page-canvas .mdx-page')
  await expect(body).toBeVisible()
  await expect(body.locator('.mdx-term')).toBeVisible()

  // The computed expression evaluated (1 of 2), and the raw source is NOWHERE.
  await expect(body).toContainText('1 of 2')
  await expect(body).not.toContainText('export const')
  await expect(body).not.toContainText('DONE.filter')

  // And it is NOT sitting in an editable TipTap surface.
  await expect(page.locator('.page-canvas .ProseMirror')).toHaveCount(0)
})
