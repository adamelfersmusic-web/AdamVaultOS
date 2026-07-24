import { useEffect, useState } from 'react'

// <ObjectionSim /> — a branching sales-call simulator. Each response the
// learner picks moves the prospect down a different path and shifts a live
// close-probability meter; the call ends in a review dashboard (probability
// trajectory + the moves you made + a "drill next" callout). Practice-layer
// component for the Escensus training notes. Generic final-expense
// placeholders; the real branches/coaching come from scored calls.

type Grade = 'strong' | 'ok' | 'weak'
interface Choice { t: string; mv: string; d: number; r: string; grade: Grade }
interface Fork { beat: string; line: string; choices: Choice[] }

const FORKS: Fork[] = [
  {
    beat: 'The objection',
    line: "It's just too expensive right now.",
    choices: [
      { t: "“Totally understand — money's tight. But if something happened tomorrow, who's stuck with the bill? That's why we start with the most affordable option that still protects them. Would $30 a month work, or should we go lower?”", mv: 'Acknowledge → Reframe → Re-close', d: 28, r: "Huh. I mean… thirty's not crazy, I guess.", grade: 'strong' },
      { t: "“I hear you. What would feel comfortable for you, monthly?”", mv: 'Acknowledge → Isolate', d: 8, r: "I dunno… what's the cheapest you've got?", grade: 'ok' },
      { t: "“Oh, okay, no worries — want me to just email you the details?”", mv: 'Concede the objection', d: -22, r: "Yeah, that's probably better. Send it over.", grade: 'weak' },
    ],
  },
  {
    beat: 'The stall',
    line: "Actually… I really should run this by my wife first.",
    choices: [
      { t: "“That's the right instinct — she's probably the whole reason you're doing this. Let's lock today's rate while you qualify at this health, and you've got 30 days to decide together. Not on board? Cancel, no cost. Fair?”", mv: 'Reframe → Risk-free lock', d: 26, r: "…Okay. Yeah, that actually makes sense.", grade: 'strong' },
      { t: "“Of course — take your time and talk it over.”", mv: 'Acknowledge, no ask', d: 4, r: "Cool. I'll get back to you.", grade: 'ok' },
      { t: "“No problem, I'll follow up with you next week.”", mv: 'Cave', d: -20, r: "Sounds good. Bye now.", grade: 'weak' },
    ],
  },
  {
    beat: 'The close',
    line: 'So how does the payment part actually work?',
    choices: [
      { t: "“Perfect. I'll just grab the account you'd like it drafted from — same as any auto-pay — and get you protected today.”", mv: 'Confident staircase', d: 24, r: "Alright… let me grab my checkbook.", grade: 'strong' },
      { t: "“So, um, next we'd need your bank info, if that's okay?”", mv: 'Hesitant ask', d: 4, r: "Oh… over the phone? I don't know about that.", grade: 'ok' },
      { t: "“I know this part's a little awkward, sorry — we'd need your banking details eventually.”", mv: 'Apologetic', d: -18, r: "Yeah… let me think about it.", grade: 'weak' },
    ],
  },
]

const fillColor = (v: number) => (v >= 70 ? 'var(--hit)' : v >= 45 ? 'var(--gold)' : 'var(--red)')
const textColor = (v: number) => (v >= 70 ? 'var(--hit)' : v >= 45 ? 'var(--gold-bright)' : 'var(--red)')

export function ObjectionSim() {
  const [phase, setPhase] = useState<'start' | 'fork' | 'results'>('start')
  const [fi, setFi] = useState(0)
  const [momentum, setMomentum] = useState(50)
  const [history, setHistory] = useState<number[]>([50])
  const [picks, setPicks] = useState<Choice[]>([])
  const [picked, setPicked] = useState<Choice | null>(null)

  const begin = () => {
    setMomentum(50); setHistory([50]); setPicks([]); setFi(0); setPicked(null); setPhase('fork')
  }
  const choose = (c: Choice) => {
    if (picked) return
    const next = Math.max(2, Math.min(98, momentum + c.d))
    setMomentum(next); setHistory((h) => [...h, next]); setPicks((p) => [...p, c]); setPicked(c)
  }
  const advance = () => {
    if (fi + 1 < FORKS.length) { setFi(fi + 1); setPicked(null) } else setPhase('results')
  }

  return (
    <div className="mdx-sim" contentEditable={false}>
      {phase !== 'start' && (
        <div className="mdx-sim-odds">
          <div className="mdx-sim-odds-top">
            <span className="mdx-sim-odds-lbl">Close probability</span>
            <span className="mdx-sim-odds-val" style={{ color: textColor(momentum) }}>
              {Math.round(momentum)}%{picked ? <span className="mdx-sim-odds-d" style={{ color: picked.d >= 0 ? 'var(--hit)' : 'var(--red)' }}> {picked.d >= 0 ? '▲ +' : '▼ '}{picked.d}</span> : null}
            </span>
          </div>
          <div className="mdx-sim-odds-bar">
            <span className="mdx-sim-odds-fill" style={{ width: `${momentum}%`, background: fillColor(momentum) }} />
          </div>
        </div>
      )}

      {phase === 'start' && (
        <div className="mdx-sim-screen">
          <p className="mdx-sim-eyebrow">Escensus · Practice · Objection Simulator</p>
          <h3 className="mdx-sim-h1">A call is a branching decision.</h3>
          <p className="mdx-sim-lede">You've shown the numbers. The prospect goes quiet, then pushes back. Every response you pick sends them down a different path — watch your close probability move with each one.</p>
          <button className="mdx-sim-gold" onClick={begin}>Take the call →</button>
        </div>
      )}

      {phase === 'fork' && (
        <div className="mdx-sim-screen">
          <div className="mdx-sim-beat">Fork {fi + 1} of {FORKS.length} · {FORKS[fi].beat}</div>
          <div className="mdx-sim-bubble">
            <span className="mdx-sim-who">👤</span>
            <span className="mdx-sim-say">{FORKS[fi].line}</span>
          </div>
          <div className="mdx-sim-choices">
            {FORKS[fi].choices.map((c, i) => {
              const chosen = picked === c
              const border = picked ? (chosen ? (c.d >= 20 ? 'var(--hit)' : c.d >= 0 ? 'var(--gold)' : 'var(--red)') : undefined) : undefined
              return (
                <button
                  key={i}
                  className="mdx-sim-choice"
                  disabled={!!picked}
                  style={{ opacity: picked && !chosen ? 0.4 : 1, borderColor: border }}
                  onClick={() => choose(c)}
                >
                  {c.t}
                  <span className="mdx-sim-mv">{c.mv}</span>
                </button>
              )
            })}
          </div>
          {picked && (
            <>
              <div className="mdx-sim-react"><b>Prospect:</b> “{picked.r}”</div>
              <div className="mdx-sim-cont">
                <button className="mdx-sim-gold" onClick={advance}>
                  {fi + 1 < FORKS.length ? 'Next →' : 'See how the call went →'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'results' && (
        <SimResults momentum={momentum} history={history} picks={picks} onReplay={() => setPhase('start')} />
      )}
    </div>
  )
}

function SimResults({ momentum, history, picks, onReplay }: {
  momentum: number; history: number[]; picks: Choice[]; onReplay: () => void
}) {
  const outcome = momentum >= 72
    ? { tag: 'Closed', color: 'var(--hit)', line: 'She read you her account number. Policy bound.' }
    : momentum >= 45
      ? { tag: 'Stalled', color: 'var(--gold-bright)', line: "She didn't say no — but she didn't say yes. This one needs a follow-up, and it might not come." }
      : { tag: 'Lost', color: 'var(--red)', line: "The line went cold. You'll email the info. You both know how that ends." }

  const R = 52, C = 2 * Math.PI * R
  const [offset, setOffset] = useState(C)
  useEffect(() => {
    const id = setTimeout(() => setOffset(C * (1 - momentum / 100)), 60)
    return () => clearTimeout(id)
  }, [C, momentum])

  // trajectory chart
  const W = 440, H = 96, pad = 6, n = history.length
  const X = (i: number) => pad + (i * (W - 2 * pad)) / (n - 1)
  const Y = (v: number) => H - pad - (v / 100) * (H - 2 * pad)
  const line = history.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
  const area = `M${X(0)},${H - pad} ` + history.map((v, i) => `L${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ') + ` L${X(n - 1)},${H - pad} Z`

  const labels = ['Handled the price', 'Handled the stall', 'Led the close']
  let weakest = 0, low = 99
  picks.forEach((c, i) => { if (c.d < low) { low = c.d; weakest = i } })
  const fixes = [
    'leading the price reframe instead of conceding',
    'locking the rate risk-free instead of letting the spouse-stall drift',
    'asking for the bank details with confidence, not an apology',
  ]

  return (
    <div className="mdx-sim-screen">
      <p className="mdx-sim-eyebrow">Call review · how it went</p>

      <div className="mdx-sim-card mdx-sim-verdict">
        <div className="mdx-sim-ring">
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            <circle className="mdx-sim-rbg" cx="60" cy="60" r={R} fill="none" strokeWidth="8" />
            <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" stroke={outcome.color}
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1s ease' }} />
          </svg>
          <div className="mdx-sim-rnum">{Math.round(momentum)}%</div>
        </div>
        <div className="mdx-sim-otag" style={{ color: outcome.color }}>{outcome.tag}</div>
        <div className="mdx-sim-oline">{outcome.line}</div>
      </div>

      <div className="mdx-sim-card">
        <div className="mdx-sim-viz-lbl">Your close probability, moment to moment</div>
        <svg className="mdx-sim-traj" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="mdxSimG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--gold)" />
              <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((v) => (
            <line key={v} className="mdx-sim-grid" x1={pad} y1={Y(v)} x2={W - pad} y2={Y(v)} />
          ))}
          <path d={area} fill="url(#mdxSimG)" opacity="0.18" />
          <path d={line} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {history.map((v, i) => (
            <circle key={i} cx={X(i)} cy={Y(v)} r="3.5" fill="var(--gold-bright)" />
          ))}
        </svg>
        <div className="mdx-sim-traj-x"><span>Start</span><span>Objection</span><span>Stall</span><span>Close</span></div>
      </div>

      <div className="mdx-sim-card">
        <div className="mdx-sim-viz-lbl">The moves you made</div>
        <div className="mdx-sim-beats">
          {picks.map((c, i) => {
            const pct = c.grade === 'strong' ? 100 : c.grade === 'ok' ? 55 : 20
            const col = c.grade === 'strong' ? 'var(--hit)' : c.grade === 'ok' ? 'var(--gold)' : 'var(--red)'
            const tag = c.grade === 'strong' ? 'strong' : c.grade === 'ok' ? 'soft' : 'missed'
            return (
              <div className="mdx-sim-brow" key={i}>
                <span className="mdx-sim-bn">{labels[i]}</span>
                <span className="mdx-sim-track"><span className="mdx-sim-bfill" style={{ width: `${pct}%`, background: col }} /></span>
                <span className="mdx-sim-bv" style={{ color: col }}>{tag}</span>
              </div>
            )
          })}
        </div>
        <div className="mdx-sim-callout">
          <b>Drill next:</b> your call turned at <b>{labels[weakest].toLowerCase()}</b>. Reps on {fixes[weakest]}.
        </div>
      </div>

      <div className="mdx-sim-cont" style={{ justifyContent: 'center' }}>
        <button className="mdx-sim-ghost" onClick={onReplay}>Run the call again</button>
      </div>
    </div>
  )
}
