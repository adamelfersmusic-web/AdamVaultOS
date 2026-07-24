// <ObjectionSim /> renders and branches inside an mdx note. Mock-only.
import { test, expect, type Page } from '@playwright/test'

const MOCK = 'http://127.0.0.1:8787'
const TOKEN = 'atelier-test-token'
const AUTH = { Authorization: `Bearer ${TOKEN}` }
const NOTE = 'Atelier/Method/ai-primer/_sim-test'

async function seed(page: Page) {
  await page.request.post(`${MOCK}/__test/reset`)
  const res = await page.request.post(`${MOCK}/api/notes`, {
    headers: AUTH,
    data: { path: NOTE, extension: 'mdx', content: '## Sim\n\n<ObjectionSim />\n', tags: [], metadata: {} },
  })
  expect(res.status(), await res.text()).toBe(201)
}

test.skip(!!process.env.REAL_VAULT, 'mock-only spec')

test('<ObjectionSim>: renders, branches, and scores', async ({ page }) => {
  await seed(page)
  await page.addInitScript(
    ([url, token]) => localStorage.setItem('adamvaultos.vault', JSON.stringify({ url, token })),
    [MOCK, TOKEN] as const,
  )
  await page.goto(`/#/note/${NOTE.split('/').map(encodeURIComponent).join('/')}`)
  const sim = page.getByTestId('note-body').locator('.mdx-sim')
  await expect(sim).toBeVisible()

  await sim.getByRole('button', { name: /Take the call/ }).click()
  // first fork + the live odds meter appear
  await expect(sim.locator('.mdx-sim-odds')).toBeVisible()
  await expect(sim.locator('.mdx-sim-choice')).toHaveCount(3)

  // pick the strong response each fork; odds should rise and prospect reacts
  for (let f = 0; f < 3; f++) {
    await sim.locator('.mdx-sim-choice').first().click()
    await expect(sim.locator('.mdx-sim-react')).toBeVisible()
    await sim.locator('.mdx-sim-cont button').click()
  }
  // dashboard: verdict ring + trajectory + moves
  await expect(sim.locator('.mdx-sim-verdict')).toBeVisible()
  await expect(sim.locator('.mdx-sim-traj')).toBeVisible()
  await expect(sim.locator('.mdx-sim-otag')).toContainText('Closed')
})
