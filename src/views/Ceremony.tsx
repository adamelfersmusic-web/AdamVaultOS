// The ceremonial wing — two monument rooms, deliberately outside the nav.
// The Commandments hold the laws the system lives by; the Map is the whole
// operating loop drawn as a temple cross-section, every chamber a real door.
// Both stay torch-lit in either app theme: a stele does not switch to day
// mode. The only interactive thing in the Commandments room is leaving it.

import { useEffect, useState } from 'react'
import { navigate } from '../lib/router'
import { openVaultPath } from '../lib/vaultLinks'
import { openPalette, useUi } from '../lib/ui'
import { fetchNote, fetchVaultAsset } from '../lib/store'

/** Return to wherever the visitor came from; a fresh tab lands on the front
 * door instead of backing out of the app. */
function leave(): void {
  if (window.history.length > 1) window.history.back()
  else navigate({ kind: 'projects' })
}

/** Escape leaves the room — unless an overlay (Omnibar / Ask AI) owns the key. */
function useEscapeToLeave(): void {
  const ui = useUi()
  const overlayOpen = ui.paletteOpen || ui.askAiOpen
  useEffect(() => {
    if (overlayOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        leave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlayOpen])
}

/** The way in — on every monument, one pronounced-but-quiet gem door onto
 * the Cockpit. Sits above the monument cross-link: brighter, bordered, and
 * unmistakably clickable, but cut from the same stone. */
function EnterTheVault() {
  return (
    <div className="cere-enter">
      <button
        type="button"
        data-testid="enter-vault"
        onClick={() => navigate({ kind: 'projects' })}
      >
        enter the vault
      </button>
    </div>
  )
}

function Seal({ size }: { size: number }) {
  return (
    <div className="cere-seal" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 32 32">
        <path d="M16 4.5 27.5 16 16 27.5 4.5 16Z" fill="none" stroke="#35b8ad" strokeWidth="1.6" />
        <circle cx="16" cy="16" r="2.6" fill="#35b8ad" />
      </svg>
    </div>
  )
}

/** Clicking the void (not the monument) leaves the room. */
function voidClick(e: React.MouseEvent<HTMLDivElement>): void {
  if (e.target === e.currentTarget) leave()
}

// ————————————————————————————————— The sky ———————————————————————————————

/** The vault controls the sky: the Map's backdrop is whatever image lives in
 * this note. Replace the image there and the heavens update — no deploy. */
const SKY_NOTE = 'pages/knowledge-graph'

/** First vault-storage image in the sky note, resolved to an auth-safe blob
 * URL (the same machinery note bodies use). Any failure → no sky, no error:
 * the void is a perfectly good sky. */
function useMapSky(): string | null {
  const [sky, setSky] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    let created: string | null = null
    fetchNote(SKY_NOTE)
      .then((note) => {
        if (cancelled || !note?.content) return
        const m = note.content.match(
          /<img[^>]*src="(\/api\/storage\/[^"]+)"|!\[[^\]]*\]\((\/api\/storage\/[^)\s]+)/,
        )
        const path = m?.[1] ?? m?.[2]
        if (!path) return
        return fetchVaultAsset(path).then((url) => {
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }
          created = url
          setSky(url)
        })
      })
      .catch(() => {
        /* the void is a perfectly good sky */
      })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [])
  return sky
}

// ————————————————————————————————— The Commandments ——————————————————————————

const LAWS: Array<{ num: string; law: string; gloss: string }> = [
  {
    num: 'I',
    law: 'Capture everything. Commit nothing.',
    gloss:
      'Every thought enters the vault the moment it appears. Only Monday may turn a thought into a vow.',
  },
  {
    num: 'II',
    law: 'Speak your week once, aloud.',
    gloss: 'Talk; the machine files. You were built to think, not to organize.',
  },
  {
    num: 'III',
    law: 'Three wins make a week.',
    gloss:
      'Finish the three before reaching for a fourth. Completion buys headroom; appetite does not.',
  },
  {
    num: 'IV',
    law: 'When lost, there is one door.',
    gloss: 'Do not decide how to become found. Open the Plan, and be told what matters.',
  },
  {
    num: 'V',
    law: 'Raw is sacred.',
    gloss: 'Never polish the voice that first spoke. The record outranks the memory of it.',
  },
  {
    num: 'VI',
    law: 'Supersede; never destroy.',
    gloss: 'Truth is layered, not erased. What is finished points forward to what replaced it.',
  },
  {
    num: 'VII',
    law: 'Everything has one home.',
    gloss: 'A thought without an address is already lost. Link it, or lose it.',
  },
  {
    num: 'VIII',
    law: 'The machine proposes. The human decides.',
    gloss: 'Always in that order. Never the reverse.',
  },
  {
    num: 'IX',
    law: 'No ritual earns a button before hands have proved it.',
    gloss: 'Manual before automatic — twice by hand, then forever by machine.',
  },
  {
    num: 'X',
    law: 'Mirror your memory.',
    gloss:
      'What exists in one place does not yet exist. The vault keeps the mind; the mirror keeps the vault.',
  },
]

export function CommandmentsView() {
  useEscapeToLeave()
  return (
    <div className="cere-void" onClick={voidClick} data-testid="commandments">
      <article className="cere-stele" aria-label="The Ten Commandments of the Vault">
        <Seal size={54} />
        <h1 className="cere-title">
          The Ten Commandments
          <br />
          of the Vault
        </h1>
        <p className="cere-provenance">
          cut for the keeper and the machine that keeps with him —<br />
          legible in any age, before this one and after it
        </p>
        <div className="cere-rule" aria-hidden="true">
          <span>◆</span>
        </div>
        <ol className="cere-laws">
          {LAWS.map((l) => (
            <li key={l.num}>
              <span className="cere-num">{l.num}</span>
              <span className="cere-law">{l.law}</span>
              <span className="cere-gloss">{l.gloss}</span>
            </li>
          ))}
        </ol>
        <p className="cere-epilogue">
          The vault remembers,
          <br />
          so the mind may wander.
        </p>
        <p className="cere-colophon">
          <span className="cere-gemline">◇ &nbsp;•&nbsp; ◇</span>
          <br />
          cut in the year MMXXVI · for Adam, keeper of the vault
          <br />
          and for the machine that keeps it with him
        </p>
        <EnterTheVault />
        <div className="cere-cross">
          <button type="button" onClick={() => navigate({ kind: 'map' })}>
            the map →
          </button>
        </div>
      </article>
    </div>
  )
}

// ———————————————————————————————————— The Map ————————————————————————————————

function Chamber({
  eyebrow,
  name,
  gloss,
  addr,
  onOpen,
  side,
  crypt,
  testid,
  children,
}: {
  eyebrow: string
  name: string
  gloss: string
  addr: string
  onOpen?: () => void
  side?: boolean
  crypt?: boolean
  testid?: string
  children?: React.ReactNode
}) {
  const cls = `cere-chamber${side ? ' is-side' : ''}${crypt ? ' is-crypt' : ''}`
  const body = (
    <>
      <span className="cere-eyebrow">{eyebrow}</span>
      <span className="cere-name">{name}</span>
      <span className="cere-chamber-gloss">{gloss}</span>
      {children}
      <span className="cere-addr">{addr}</span>
    </>
  )
  // Chambers with a destination are real doors; the Mirror sleeps and is not.
  return onOpen ? (
    <button type="button" className={cls} onClick={onOpen} data-testid={testid}>
      {body}
    </button>
  ) : (
    <div className={cls} data-testid={testid}>
      {body}
    </div>
  )
}

function Passage({ variant }: { variant?: string }) {
  return <div className={`cere-passage${variant ? ` ${variant}` : ''}`} aria-hidden="true" />
}

function Level({ label }: { label: string }) {
  return (
    <div className="cere-level">
      <span>{label}</span>
    </div>
  )
}

export function MapView() {
  useEscapeToLeave()
  const sky = useMapSky()
  return (
    <div className="cere-void" onClick={voidClick} data-testid="vault-map">
      {sky && (
        <>
          <div
            className="cere-sky"
            data-testid="map-sky"
            style={{ backgroundImage: `url(${sky})` }}
            aria-hidden="true"
          />
          <div className="cere-sky-veil" aria-hidden="true" />
        </>
      )}
      <div className="cere-temple">
        <Seal size={46} />
        <h1 className="cere-title cere-title-map">The Map</h1>
        <p className="cere-subtitle">Chambers of the Vault</p>
        <p className="cere-provenance">
          a floor plan you stand in, not a manual you read —<br />
          every chamber is a door
        </p>

        <Level label="the surface · two doors" />
        <div className="cere-doors">
          <Chamber
            eyebrow="you enter here"
            name="The Plan"
            gloss="When lost, do not decide how to become found. This door tells you what matters."
            addr="desk/00-plan"
            onOpen={() => void openVaultPath('desk/00-plan')}
            testid="chamber-plan"
          />
          <Chamber
            eyebrow="thoughts enter here"
            name="The Capture"
            gloss="Open in every hour of every age. Nothing is refused; nothing is filed at the door."
            addr="⌘K · the dock"
            onOpen={() => openPalette()}
            testid="chamber-capture"
          />
        </div>

        <Passage />
        <Level label="the monday chamber" />
        <Chamber
          eyebrow="once a week · spoken aloud"
          name="The Heartbeat"
          gloss="You speak the week once, and the machine writes. The old week is closed with honesty; the new one is vowed out loud."
          addr="desk/weekly · every monday"
          onOpen={() => void openVaultPath('desk/weekly/template')}
          testid="chamber-heartbeat"
        >
          <span className="cere-mint">
            <span className="cere-mint-title">The Mint — the furnace at its center</span>
            <span className="cere-mint-item">the weekly note, sealed with a date</span>
            <span className="cere-mint-item">a card for every world that moves</span>
            <span className="cere-mint-item">a tracker row for every vow</span>
            <span className="cere-mint-item is-return">
              a fresh Plan — this one climbs back up to the surface door
            </span>
          </span>
        </Chamber>

        <Passage variant="p2" />
        <Level label="the gallery" />
        <Chamber
          eyebrow="one room per life"
          name="The Worlds"
          gloss="Each world keeps a spine — the long plan, the one current phase, and this week's card. No world speaks for another."
          addr="#/projects"
          onOpen={() => navigate({ kind: 'projects' })}
          testid="chamber-worlds"
        >
          <span className="cere-worlds">
            {['Amanda', 'Escensus', 'Music', 'Health', 'Personal'].map((w) => (
              <span key={w} className="cere-world">
                {w}
              </span>
            ))}
          </span>
        </Chamber>

        <Passage variant="p3" />
        <Level label="the hall of motion" />
        <Chamber
          eyebrow="every vow becomes a row"
          name="The Tracker"
          gloss="“Now” shows only what moves this week. Everything else waits in its place — unseen, but never lost."
          addr="#/tracker"
          onOpen={() => navigate({ kind: 'tracker' })}
          testid="chamber-tracker"
        />

        <Passage variant="p4" />
        <Level label="the great hall" />
        <Chamber
          eyebrow="everything has one home"
          name="The Vault"
          gloss="Raw is sacred. What is finished is superseded, never destroyed. Nine hundred notes and counting, each with an address — a thought without one is already lost."
          addr="the library · ⌘K finds anything"
          onOpen={() => navigate({ kind: 'library' })}
          testid="chamber-vault"
        />

        <Passage variant="dashed" />
        <Chamber
          side
          eyebrow="the side passage"
          name="The Janitor"
          gloss="Walks the halls when summoned and leaves a list of what it would mend, carved at the sweep stone. It proposes. It never touches."
          addr="desk/00-sweep"
          onOpen={() => void openVaultPath('desk/00-sweep')}
          testid="chamber-janitor"
        />

        <Passage variant="p5" />
        <Level label="the crypt" />
        <Chamber
          crypt
          eyebrow="beneath everything"
          name="The Mirror"
          gloss="A second vault, cut in stone elsewhere. What exists in one place does not yet exist — the vault keeps the mind; the mirror keeps the vault."
          addr="the private mirror"
          testid="chamber-mirror"
        />

        <p className="cere-epilogue">You are always somewhere on this map.</p>
        <p className="cere-colophon">
          <span className="cere-gemline">◇ &nbsp;•&nbsp; ◇</span>
          <br />
          surveyed in the year MMXXVI
          <br />
          the machine proposes · the human decides
        </p>
        <EnterTheVault />
        <div className="cere-cross">
          <button type="button" onClick={() => navigate({ kind: 'commandments' })}>
            the commandments →
          </button>
        </div>
      </div>
    </div>
  )
}
