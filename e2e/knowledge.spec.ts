// Knowledge-layer smoke tests: backlinks (#10) and search-as-cards (#5).
// Connects via the app's own session key (token mode), seeds linked notes,
// and drives the real UI against the mock.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}

async function seedNote(
  page: Page,
  path: string,
  content: string,
  opts: { tags?: string[]; metadata?: Record<string, unknown> } = {},
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags: opts.tags ?? [], metadata: opts.metadata ?? {} },
  })
  expect(res.status(), await res.text()).toBe(201)
}

async function connectViaStorage(page: Page) {
  await page.addInitScript(
    ([key, url, token]) => {
      localStorage.setItem(
        key,
        JSON.stringify({ vaultUrl: url, mode: 'token', token: { accessToken: token } }),
      )
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}

const noteUrl = (path: string) =>
  'http://127.0.0.1:4173/#/note/' + encodeURIComponent(path)

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('Backlinks — a note shows what it cites and what cites it', async ({ page }) => {
  await seedNote(page, 'Amanda/00-home', '# Amanda Home\n\nSee [[Amanda/01-overview]].', {
    tags: ['amanda', 'client'],
    metadata: { summary: 'Front door for the Amanda project.' },
  })
  await seedNote(page, 'Amanda/01-overview', '# Overview', {
    tags: ['amanda'],
    metadata: { summary: 'Strategy layer for the campaign.' },
  })
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  // The home note CITES the overview — shown with the overview's own summary.
  await page.goto(noteUrl('Amanda/00-home'))
  const back = page.getByTestId('backlinks')
  await expect(back).toBeVisible()
  await expect(back).toContainText('Links from this note')
  await expect(back.locator('.link-card', { hasText: 'Overview' })).toBeVisible()
  await expect(back).toContainText('Strategy layer for the campaign.')

  // The overview shows the reverse edge — CITED BY the home note.
  await page.goto(noteUrl('Amanda/01-overview'))
  const back2 = page.getByTestId('backlinks')
  await expect(back2).toBeVisible()
  await expect(back2).toContainText('Linked from')
  await expect(back2.locator('.link-card', { hasText: 'Home' })).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

test('Search cards — Library rows carry a type dot and the note summary', async ({ page }) => {
  await seedNote(page, 'atelier/meetings/2026-06-15-cassy', '# Cassy check-in\n\nNotes…', {
    tags: ['meeting', 'cassy'],
    metadata: { summary: 'Weekly check-in with Cassy — Planable review.' },
  })
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/library')
  const row = page.locator('.note-row', { hasText: 'Cassy check-in' })
  await expect(row).toBeVisible()
  await expect(row.locator('.type-dot')).toBeVisible() // the note-type dot
  await expect(row).toContainText('Weekly check-in with Cassy') // summary as the preview
})
