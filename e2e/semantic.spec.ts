// SEMANTIC SEARCH — the Omnibar's ✨ Related group, backed by the local
// hash-ngram embedder + IndexedDB vector index. Deterministic by design:
// hash-ngram-v1 is a pure function of the text, so every cosine in here is
// the same on every run. Covers: a meaning-ish hit keyword search misses,
// keyword/Related dedup, operator-only silence, the reload-reuses-IndexedDB
// diff, and the one-note re-embed after an out-of-band edit.

import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

interface SemanticDebug {
  ready: boolean
  building: boolean
  firstEver: boolean
  embedderId: string
  vectorCount: number
  embeddedThisSession: number
}

async function reset(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
}

async function seed(
  page: Page,
  path: string,
  content: string,
  tags: string[] = [],
  metadata: Record<string, unknown> = {},
) {
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path, content, tags, metadata },
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
      localStorage.setItem('adamvaultos.anthropicKey', 'sk-test-key')
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}

async function openBar(page: Page) {
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByTestId('omnibar')).toBeVisible()
}

/** The index is synced (first build done or nothing to do) — safe to assert
 * on __semanticDebug counters. */
async function waitIndexed(page: Page) {
  await page.waitForFunction(() => {
    const d = (window as unknown as { __semanticDebug?: { ready: boolean } })
      .__semanticDebug
    return d?.ready === true
  })
}

function semanticDebug(page: Page): Promise<SemanticDebug> {
  return page.evaluate(
    () =>
      (window as unknown as { __semanticDebug: unknown }).__semanticDebug as never,
  )
}

// Note A: about customizable interfaces users remix. The test query
// "customize and remix the interface" shares STEMS with it (customize ↔
// customizable via char-grams) but is NOT a keyword AND-hit ("customize"
// appears nowhere verbatim). Note B is honestly unrelated and must stay
// below SEMANTIC_FLOOR.
const NOTE_A_PATH = 'notes/remix-studio'
const NOTE_A =
  '# Remix Studio\n\nA customizable interface that users remix and reshape to their own taste. Panels, themes, layouts — everything invites remixing.\n'
const NOTE_B_PATH = 'notes/sourdough-log'
const NOTE_B =
  '# Sourdough Log\n\nFed the starter at dawn, baked at high hydration, the crumb came out open and glossy.\n'

test.beforeEach(async ({ page }) => {
  await reset(page)
  await seed(page, NOTE_A_PATH, NOTE_A)
  await seed(page, NOTE_B_PATH, NOTE_B)
  await connectViaStorage(page)
  await page.goto('/#/library')
  await expect(page.getByTestId('browser')).toBeVisible()
})

test('meaning-ish match: Related finds the note keyword search misses', async ({ page }) => {
  await openBar(page)
  await waitIndexed(page)

  // Stem overlap, zero keyword AND-hit ("customize" is nowhere verbatim).
  await page.fill('.palette-input', 'customize and remix the interface')

  const relatedRows = page.locator('.palette-item[data-group="related"]')
  await expect(page.locator('.palette-group', { hasText: 'Related' })).toBeVisible()
  // The remix note is the top Related hit…
  await expect(relatedRows.first()).toContainText('Remix Studio')
  await expect(relatedRows.first()).toContainText(NOTE_A_PATH)
  await expect(relatedRows.first()).toContainText('related') // the muted hint
  // …and it is genuinely NOT a keyword hit (that's the whole point).
  await expect(
    page.locator('.palette-item[data-group="notes"]', { hasText: 'Remix Studio' }),
  ).toHaveCount(0)
  // The unrelated note stays under the floor — no fake serendipity.
  await expect(
    page.locator('.palette-item[data-group="related"]', { hasText: 'Sourdough' }),
  ).toHaveCount(0)
})

test('a note already in keyword results does not duplicate into Related', async ({ page }) => {
  await openBar(page)
  await waitIndexed(page)

  // Every word here appears verbatim in note A → it's a keyword Notes hit.
  await page.fill('.palette-input', 'customizable interface users remix')

  const noteRows = page.locator('.palette-item[data-group="notes"]')
  await expect(noteRows.first()).toContainText('Remix Studio')

  // Related still renders (other notes clear the floor for this query) —
  // wait for it so the dedup assertion can't pass vacuously early…
  await expect(
    page.locator('.palette-item[data-group="related"]').first(),
  ).toBeVisible()
  // …but the keyword hit is NEVER echoed into it.
  await expect(
    page.locator('.palette-item[data-group="related"]', { hasText: 'Remix Studio' }),
  ).toHaveCount(0)
})

test('operator-only query shows no Related group', async ({ page }) => {
  await openBar(page)
  await waitIndexed(page)

  // Pure constraint, no free text — exact navigation, no guessing.
  await page.fill('.palette-input', 'tag:content/script')
  await expect(
    page.locator('.palette-item[data-group="notes"]').first(),
  ).toBeVisible()
  await expect(page.locator('.palette-item[data-group="related"]')).toHaveCount(0)
  await expect(page.locator('.palette-group', { hasText: 'Related' })).toHaveCount(0)
})

test('reload reuses IndexedDB — unchanged notes are not re-embedded', async ({ page }) => {
  await openBar(page)
  await waitIndexed(page)

  // First-ever build: the whole vault got embedded this session.
  const first = await semanticDebug(page)
  expect(first.embedderId).toBe('hash-ngram-v1')
  expect(first.embeddedThisSession).toBeGreaterThan(0)
  expect(first.vectorCount).toBe(first.embeddedThisSession)

  await page.reload()
  await expect(page.getByTestId('askai-fab')).toBeVisible()
  await openBar(page)
  await waitIndexed(page)

  // Same vault, same updatedAt stamps, same embedder id → the diff embeds
  // NOTHING; every vector comes back from IndexedDB.
  const second = await semanticDebug(page)
  expect(second.embeddedThisSession).toBe(0)
  expect(second.vectorCount).toBe(first.vectorCount)
})

test('editing one note re-embeds only that note on the next open', async ({ page }) => {
  await openBar(page)
  await waitIndexed(page)
  const first = await semanticDebug(page)
  expect(first.embeddedThisSession).toBeGreaterThan(1)

  // An out-of-band writer touches ONE note (new content, new updatedAt).
  const res = await page.request.post(`${MOCK}/__test/bump`, {
    data: {
      path: NOTE_A_PATH,
      content: '# Remix Studio\n\nNow with a plugin panel users can rearrange live.\n',
    },
  })
  expect(res.ok()).toBe(true)

  await page.reload()
  await expect(page.getByTestId('askai-fab')).toBeVisible()
  await openBar(page)
  await waitIndexed(page)

  // updatedAt diff → exactly that one note re-embeds; the rest load from disk.
  const second = await semanticDebug(page)
  expect(second.embeddedThisSession).toBe(1)
  expect(second.vectorCount).toBe(first.vectorCount)
})
