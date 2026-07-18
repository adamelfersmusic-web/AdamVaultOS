// ONE TASK (#/one-task) — the single-task focus surface: one task at a
// time, TYPED FRESH (no picker of existing tasks, ever), live subtasks with
// drag-reorder and tucked-away `>` notes, Done / let-it-go stamping blocks
// onto desk/one-task-log, and the kitchen timer (+10 steps, cap 90,
// end-timestamp-based). Both convention notes wear tag `desk` — never
// `task` — and never leak into the Tasks tab's loose scan.
// All expected dates are computed from new Date() — never hardcoded.

import { test, expect, type Page, type Locator } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const SESSION_KEY = 'adamvaultos.session.v1'

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
    },
    [SESSION_KEY, MOCK, TOKEN] as const,
  )
}
async function mockNote(page: Page, path: string) {
  const res = await page.request.get(
    `${MOCK}/api/notes?id=${encodeURIComponent(path)}`,
    { headers: AUTH },
  )
  return res.ok() ? res.json() : null
}
async function savedContent(page: Page, path: string): Promise<string> {
  const note = await mockNote(page, path)
  return note?.content ?? ''
}

/** Local 'YYYY-MM-DD' — the same clock todayKey() stamps with. */
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`
}

// ——— SUBTASK DRAG & DROP — the shelves/worktabs dispatch trick: Playwright's
// mouse drag can't carry a DataTransfer through the dragover guards, so the
// real event sequence is hand-dispatched with ONE shared DataTransfer. ———

async function dragDrop(page: Page, source: Locator, target: Locator, pos: 'top' | 'bottom') {
  const src = await source.elementHandle()
  const tgt = await target.elementHandle()
  if (!src || !tgt) throw new Error('drag endpoints not found')
  await page.evaluate(
    ({ src, tgt, pos }) => {
      const dt = new DataTransfer()
      const r = tgt.getBoundingClientRect()
      const x = r.left + r.width / 2
      const y = pos === 'top' ? r.top + 2 : r.bottom - 2
      const fire = (el: Element, type: string) =>
        el.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
            clientY: y,
          }),
        )
      fire(src, 'dragstart')
      fire(tgt, 'dragenter')
      fire(tgt, 'dragover')
      fire(tgt, 'drop')
      fire(src, 'dragend')
    },
    { src, tgt, pos },
  )
}

const VIEW = 'http://127.0.0.1:4173/#/one-task'
const SLOT = 'desk/one-task'
const LOG = 'desk/one-task-log'
const QUEUE = 'desk/one-task-queue'

const subRow = (page: Page, text: string) =>
  page.getByTestId('one-sub').filter({ hasText: text })

test.beforeEach(async ({ page }) => {
  await reset(page)
})

test('empty slot — typed fresh mints desk/one-task (tag desk, never task); no picker of existing tasks, ever', async ({ page }) => {
  // A full task landscape that must NEVER surface here.
  await seed(page, 'projects/amanda', '# Amanda', ['project'], {
    key: 'amanda', tag: 'amanda', status: 'active', order: 1, summary: 'x',
  })
  await seed(page, 'tasks/inbox/call-venue', 'Call the venue', ['task'], {
    state: 'next', when: 'later', done: false,
  })
  await seed(page, 'tasks/amanda/shoot', 'Shoot the photos', ['task'], {
    project: 'amanda', state: 'active', when: 'later', done: false,
  })
  await seed(page, 'pages/studio-notes', '# Studio Notes\n\n- [ ] Restring the guitar\n')
  await connectViaStorage(page)

  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(VIEW)
  const view = page.getByTestId('one-task-view')
  const input = page.getByTestId('one-input')
  await expect(input).toBeVisible()
  await expect(input).toHaveAttribute('placeholder', 'What’s the one task?')

  // The empty slot lists NOTHING — and typing summons no suggestions.
  await expect(view).not.toContainText('Call the venue')
  await expect(view).not.toContainText('Shoot the photos')
  await expect(view).not.toContainText('Restring the guitar')
  await input.fill('Call')
  await expect(view).not.toContainText('Call the venue')

  // Typed fresh + Enter → the task goes active, the name is the hero.
  await input.fill('Ship the demo reel')
  await input.press('Enter')
  await expect(page.getByTestId('one-hero')).toHaveText('Ship the demo reel')

  // While a task is active there is NO way to start another…
  await expect(page.getByTestId('one-input')).toHaveCount(0)
  // …and still no other task in sight.
  await expect(view).not.toContainText('Call the venue')

  // The slot note: exact content, tag `desk` — NEVER `task` (Tracker-blind).
  await expect.poll(async () => (await mockNote(page, SLOT))?.content).toBe('# Ship the demo reel\n')
  const note = await mockNote(page, SLOT)
  expect(note.tags).toContain('desk')
  expect(note.tags).not.toContain('task')

  expect(errors, errors.join('\n')).toEqual([])
})

test('subtasks — add, check, tucked-away note; the note holds the truth across a reload', async ({ page }) => {
  await seed(page, SLOT, '# Mix the record\n\n- [ ] Bounce stems\n- [ ] Send to mastering\n', ['desk'])
  await connectViaStorage(page)

  await page.goto(VIEW)
  await expect(page.getByTestId('one-hero')).toHaveText('Mix the record')
  await expect(page.getByTestId('one-sub')).toHaveCount(2)

  // Add a step — Enter appends a `- [ ]` line after the last block.
  await page.getByTestId('one-add').fill('Upload final')
  await page.getByTestId('one-add').press('Enter')
  await expect(page.getByTestId('one-sub')).toHaveCount(3)
  await expect
    .poll(() => savedContent(page, SLOT))
    .toBe('# Mix the record\n\n- [ ] Bounce stems\n- [ ] Send to mastering\n- [ ] Upload final\n')

  // Check one — the byte between the brackets flips, nothing else moves.
  await subRow(page, 'Bounce stems').getByTestId('one-sub-check').click()
  await expect
    .poll(() => savedContent(page, SLOT))
    .toContain('- [x] Bounce stems')
  await expect(page.getByTestId('one-progress')).toContainText('1 of 3')

  // Tuck a note under a subtask: chevron → quiet input → Enter saves an
  // indented `>` line directly beneath the checkbox line.
  await subRow(page, 'Send to mastering').getByTestId('one-sub-notetoggle').click()
  const noteInput = page.getByTestId('one-sub-note')
  await noteInput.fill('ask about the deposit')
  await noteInput.press('Enter')
  await expect
    .poll(() => savedContent(page, SLOT))
    .toContain('- [ ] Send to mastering\n    > ask about the deposit')

  // Checking the noted subtask preserves the note line.
  await subRow(page, 'Send to mastering').getByTestId('one-sub-check').click()
  await expect
    .poll(() => savedContent(page, SLOT))
    .toContain('- [x] Send to mastering\n    > ask about the deposit')

  // Reload — task, checks, note, AND the open toggle all survive (the vault
  // holds the facts; the toggle rides localStorage).
  await page.reload()
  await expect(page.getByTestId('one-hero')).toHaveText('Mix the record')
  await expect(subRow(page, 'Bounce stems').getByTestId('one-sub-check')).toBeChecked()
  await expect(page.getByTestId('one-progress')).toContainText('2 of 3')
  await expect(page.getByTestId('one-sub-note')).toHaveValue('ask about the deposit')
})

test('reorder — one write on drop, line order lands in the note, `>` notes travel with their subtask', async ({ page }) => {
  await seed(
    page,
    SLOT,
    '# Pack the studio\n\n- [ ] Wrap cables\n    > label each loom\n- [ ] Box the mics\n- [ ] Load the van\n',
    ['desk'],
  )
  await connectViaStorage(page)

  await page.goto(VIEW)
  await expect(page.getByTestId('one-sub')).toHaveCount(3)

  await dragDrop(page, subRow(page, 'Load the van'), subRow(page, 'Wrap cables'), 'top')

  // The whole block moved — the noted subtask kept its note beneath it.
  await expect
    .poll(() => savedContent(page, SLOT))
    .toBe('# Pack the studio\n\n- [ ] Load the van\n- [ ] Wrap cables\n    > label each loom\n- [ ] Box the mics\n')
  await expect(page.getByTestId('one-sub').first()).toContainText('Load the van')
})

test('Done — the stamped ✅ block (notes included) mints the log, the slot empties, a new task can begin', async ({ page }) => {
  await seed(
    page,
    SLOT,
    '# Mix the record\n\n- [x] Bounce stems\n- [ ] Send to mastering\n    > ask about the deposit\n',
    ['desk'],
  )
  await connectViaStorage(page)

  await page.goto(VIEW)
  await page.getByTestId('one-done').click()

  // The slot is the empty question again…
  await expect(page.getByTestId('one-input')).toBeVisible()
  await expect.poll(() => savedContent(page, SLOT)).toBe('')

  // …and the log was CREATED with the stamped block: today's date, the ✅,
  // every subtask line byte-for-byte (unchecked preserved, note included).
  const today = ymd(new Date())
  await expect
    .poll(() => savedContent(page, LOG))
    .toBe(
      `# One Task — the log\n\n## ${today} — Mix the record ✅\n- [x] Bounce stems\n- [ ] Send to mastering\n    > ask about the deposit\n`,
    )
  const log = await mockNote(page, LOG)
  expect(log.tags).toContain('desk')
  expect(log.tags).not.toContain('task')

  // The slot accepts the next freshly typed task.
  await page.getByTestId('one-input').fill('Master the record')
  await page.getByTestId('one-input').press('Enter')
  await expect(page.getByTestId('one-hero')).toHaveText('Master the record')
  await expect.poll(() => savedContent(page, SLOT)).toBe('# Master the record\n')
})

test('let it go — the 🕊 renounced block APPENDS to an existing log; nothing above is touched', async ({ page }) => {
  await seed(page, SLOT, '# Drop the remix\n\n- [ ] chase the stems\n', ['desk'])
  await seed(
    page,
    LOG,
    '# One Task — the log\n\n## 2026-01-05 — Old thing ✅\n- [x] ancient step\n',
    ['desk'],
  )
  await connectViaStorage(page)

  await page.goto(VIEW)
  await page.getByTestId('one-letgo').click()

  await expect(page.getByTestId('one-input')).toBeVisible()
  await expect.poll(() => savedContent(page, SLOT)).toBe('')

  const today = ymd(new Date())
  const log = await savedContent(page, LOG)
  // The old block survives byte-for-byte…
  expect(log).toContain('## 2026-01-05 — Old thing ✅\n- [x] ancient step')
  // …and the renounce block sits beneath it, one blank line between.
  expect(log).toContain(`\n\n## ${today} — Drop the remix 🕊 renounced\n- [ ] chase the stems`)
})

test('no clutter — one-task subtasks and log checkboxes never reach the Tasks tab loose scan', async ({ page }) => {
  await seed(page, SLOT, '# Mix the record\n\n- [ ] Bounce stems\n', ['desk'])
  await seed(
    page,
    LOG,
    '# One Task — the log\n\n## 2026-01-05 — Old thing 🕊 renounced\n- [ ] ancient unchecked\n',
    ['desk'],
  )
  // A control loose line proves the scanner itself is alive.
  await seed(page, 'pages/studio-notes', '# Studio Notes\n\n- [ ] Restring the guitar\n')
  await connectViaStorage(page)

  await page.goto('http://127.0.0.1:4173/#/tasks')
  await page.getByTestId('tasks-chips').getByRole('tab', { name: 'All' }).click()
  const loose = page.getByTestId('tasks-loose')
  await expect(loose).toContainText('Restring the guitar')
  await expect(page.getByTestId('tasks-view')).not.toContainText('Bounce stems')
  await expect(page.getByTestId('tasks-view')).not.toContainText('ancient unchecked')
})

test('timer — +10 steps cap at 90, the countdown runs and pauses, completion settles the done state', async ({ page }) => {
  await seed(page, SLOT, '# Mix the record\n', ['desk'])
  await connectViaStorage(page)
  await page.clock.install()

  await page.goto(VIEW)
  const timer = page.getByTestId('one-timer')
  const clock = page.getByTestId('one-timer-clock')
  await expect(clock).toHaveText('0:00')
  await expect(page.getByTestId('one-timer-go')).toBeDisabled()

  // The dial: +10 taps build 10 → 90; the cap holds; −10 steps back.
  await page.getByTestId('one-timer-plus').click()
  await expect(clock).toHaveText('10:00')
  for (let i = 0; i < 8; i++) await page.getByTestId('one-timer-plus').click()
  await expect(clock).toHaveText('90:00')
  await page.getByTestId('one-timer-plus').click()
  await expect(clock).toHaveText('90:00')
  await page.getByTestId('one-timer-minus').click()
  await expect(clock).toHaveText('80:00')

  // Start — the countdown is end-timestamp-based, so fast-forwarded time
  // lands exactly.
  await page.getByTestId('one-timer-go').click()
  await expect(timer).toHaveClass(/is-running/)
  await page.clock.fastForward('05:00')
  await expect(clock).toHaveText('75:00')

  // Pause holds while the world keeps turning.
  await page.getByTestId('one-timer-go').click()
  await page.clock.fastForward('03:00')
  await expect(clock).toHaveText('75:00')

  // Reset returns to the dialed duration; a full run settles into the calm
  // done state at 0:00.
  await page.getByTestId('one-timer-reset').click()
  await expect(clock).toHaveText('80:00')
  await page.getByTestId('one-timer-go').click()
  await page.clock.fastForward('01:20:01')
  await expect(timer).toHaveClass(/is-done/)
  await expect(clock).toHaveText('0:00')
})

test('queue — parks up to three names, refuses a fourth, collapsed by default, survives reload', async ({ page }) => {
  await seed(page, SLOT, '# Mix the record\n', ['desk'])
  await connectViaStorage(page)

  await page.goto(VIEW)
  await expect(page.getByTestId('one-hero')).toHaveText('Mix the record')

  // Collapsed by default — one dim word, no panel.
  const toggle = page.getByTestId('one-queue-toggle')
  await expect(toggle).toHaveText('queue')
  await expect(page.getByTestId('one-queue-panel')).toHaveCount(0)

  // Park three names.
  await toggle.click()
  const add = page.getByTestId('one-queue-add')
  for (const name of ['Master the EP', 'Book rehearsal', 'Email the label']) {
    await add.fill(name)
    await add.press('Enter')
    await expect(page.getByTestId('one-queue-item').filter({ hasText: name })).toBeVisible()
  }
  await expect(toggle).toHaveText('queue · 3')
  await expect
    .poll(() => savedContent(page, QUEUE))
    .toBe('# One Task — the queue\n\n- Master the EP\n- Book rehearsal\n- Email the label\n')
  const note = await mockNote(page, QUEUE)
  expect(note.tags).toContain('desk')
  expect(note.tags).not.toContain('task')

  // A fourth is refused with a human sentence — the note never changes.
  await add.fill('A fourth thing')
  await add.press('Enter')
  await expect(page.locator('.toast').last()).toContainText('the queue holds three')
  await expect(page.getByTestId('one-queue-item')).toHaveCount(3)
  expect(await savedContent(page, QUEUE)).toBe(
    '# One Task — the queue\n\n- Master the EP\n- Book rehearsal\n- Email the label\n',
  )

  // Reload: the vault kept the queue, and the fold is closed again —
  // collapsed by default, ALWAYS.
  await page.reload()
  await expect(page.getByTestId('one-queue-toggle')).toHaveText('queue · 3')
  await expect(page.getByTestId('one-queue-panel')).toHaveCount(0)
})

test('queue — the empty slot offers parked names; pulling one promotes it AND removes it from the note; typing fresh still works', async ({ page }) => {
  await seed(page, SLOT, '# Mix the record\n\n- [x] Bounce stems\n', ['desk'])
  await seed(page, QUEUE, '# One Task — the queue\n\n- Master the EP\n- Book rehearsal\n', ['desk'])
  await connectViaStorage(page)

  await page.goto(VIEW)
  // While the task is active the queued names live ONLY behind the fold.
  await expect(page.getByTestId('one-queue-offer')).toHaveCount(0)

  // THE QUEUE'S MOMENT — the slot empties and the parked names surface.
  await page.getByTestId('one-done').click()
  await expect(page.getByTestId('one-input')).toBeVisible()
  const offer = page.getByTestId('one-queue-offer')
  await expect(offer.getByTestId('one-queue-pull')).toHaveCount(2)

  // Pulling one promotes it through the house start flow…
  await offer.getByTestId('one-queue-pull').filter({ hasText: 'Master the EP' }).click()
  await expect(page.getByTestId('one-hero')).toHaveText('Master the EP')
  await expect.poll(() => savedContent(page, SLOT)).toBe('# Master the EP\n')
  // …and leaves the queue note (one write, the other name untouched).
  await expect
    .poll(() => savedContent(page, QUEUE))
    .toBe('# One Task — the queue\n\n- Book rehearsal\n')

  // Resolve again: the remaining name is offered, but typing FRESH stays
  // primary and consumes nothing from the queue.
  await page.getByTestId('one-letgo').click()
  await expect(page.getByTestId('one-queue-pull')).toHaveCount(1)
  await page.getByTestId('one-input').fill('Fresh idea instead')
  await page.getByTestId('one-input').press('Enter')
  await expect(page.getByTestId('one-hero')).toHaveText('Fresh idea instead')
  expect(await savedContent(page, QUEUE)).toBe('# One Task — the queue\n\n- Book rehearsal\n')
})

test('queue — remove drops exactly one parked name; an empty queue leaves the empty slot bare', async ({ page }) => {
  await seed(page, SLOT, '# Mix the record\n', ['desk'])
  await seed(page, QUEUE, '# One Task — the queue\n\n- Master the EP\n', ['desk'])
  await connectViaStorage(page)

  await page.goto(VIEW)
  await page.getByTestId('one-queue-toggle').click()
  await page.getByTestId('one-queue-remove').click()
  await expect(page.getByTestId('one-queue-item')).toHaveCount(0)
  // Surgical: ONLY the item line vanished — the surrounding bytes survive.
  await expect.poll(() => savedContent(page, QUEUE)).toBe('# One Task — the queue\n\n')

  // With nothing parked, resolving lands on EXACTLY the bare question —
  // no queue UI at all.
  await page.getByTestId('one-letgo').click()
  await expect(page.getByTestId('one-input')).toBeVisible()
  await expect(page.getByTestId('one-queue-offer')).toHaveCount(0)
})

test('elapsed — start stamps started_at, the dim line ticks the wall clock, resolve stamps the · suffix and clears the metadata', async ({ page }) => {
  await connectViaStorage(page)
  await page.clock.install()

  await page.goto(VIEW)
  await page.getByTestId('one-input').fill('Amanda Photo Script')
  await page.getByTestId('one-input').press('Enter')
  await expect(page.getByTestId('one-hero')).toHaveText('Amanda Photo Script')

  // started_at landed in vault METADATA as a parseable ISO stamp — the
  // note is the record, so the truth survives devices.
  const note = await mockNote(page, SLOT)
  expect(typeof note.metadata.started_at).toBe('string')
  expect(Number.isNaN(Date.parse(note.metadata.started_at))).toBe(false)

  // The whisper reads 0m at birth, then tells the wall-clock truth —
  // entirely independent of the countdown timer (which was never started).
  await expect(page.getByTestId('one-elapsed')).toHaveText('on this: 0m')
  await page.clock.fastForward('02:14:00')
  await expect(page.getByTestId('one-elapsed')).toHaveText('on this: 2h 14m')

  // Resolve: the heading carries the machine-parseable ` · Xh Ym` suffix
  // (the future Daily Time Log's contract)…
  const stampDay = ymd(new Date(Date.now() + (2 * 60 + 14) * 60_000))
  await page.getByTestId('one-done').click()
  await expect(page.getByTestId('one-input')).toBeVisible()
  await expect
    .poll(() => savedContent(page, LOG))
    .toContain(`## ${stampDay} — Amanda Photo Script ✅ · 2h 14m`)

  // …and started_at is CLEARED — the key ceases to exist, never stores null.
  const cleared = await mockNote(page, SLOT)
  expect('started_at' in cleared.metadata).toBe(false)
})

test('elapsed — a pre-feature task without started_at shows no line and stamps no suffix', async ({ page }) => {
  await seed(page, SLOT, '# Mix the record\n\n- [ ] Bounce stems\n', ['desk'])
  await connectViaStorage(page)

  await page.goto(VIEW)
  await expect(page.getByTestId('one-hero')).toHaveText('Mix the record')
  await expect(page.getByTestId('one-elapsed')).toHaveCount(0)

  // Resolving stamps the plain heading — no suffix is ever guessed.
  await page.getByTestId('one-done').click()
  await expect(page.getByTestId('one-input')).toBeVisible()
  const today = ymd(new Date())
  const log = await savedContent(page, LOG)
  expect(log).toContain(`## ${today} — Mix the record ✅\n`)
  expect(log).not.toContain(' · ')
})
