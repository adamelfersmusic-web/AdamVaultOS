# The structural language audit

**Mission-critical question:** is the sound bath structure in the app *our own
language*, or did generic wellness vocabulary creep in during the build?

Audited: the nine-function taxonomy, section names, chakra intents, lane names,
and the wizard's generated arc — each traced back to the two real handouts
seeded in the app.

---

## Headline: the taxonomy is yours, and it's provable

The app ships two real sessions transcribed from handouts used at sold-out
events. The second one — *Seeding and Watering the Soil* — carries a phrase per
section, and **the first word of each phrase is a function name:**

| Real handout phrase | Function |
|---|---|
| **Earth**, Seeding | ground |
| **Trust**, Buried | *(no slot — see gap 4)* |
| **Water**, Watering the soil | wash |
| **Flow**, The blood of my life | `flow` ✅ exact |
| **Express**, from the seed | `express` ✅ exact |
| **Release** and Receive, Wash away and fill me new | `release` ✅ exact |
| **Bloom**, from the soil I grow | `bloom` ✅ exact |

**The strongest evidence is that this convergence is accidental.** The app's
`inferFunction()` derives a section's function from its *name* (`Root`,
`Ocean`, `Sacral`, `Rain`, `Heart`) and never reads the phrase at all. Yet it
independently lands on **flow / express / release / bloom** for exactly the
sections whose phrases open with those words.

Two derivations, no shared path, same answer. **The taxonomy reflects real
practitioner vocabulary, not invented product language.** That is the thing
worth protecting.

Section *names* are equally well-grounded — `Root · Ocean · Sacral · Gongs ·
Rain · Space · Heart · Chimes` all appear verbatim on the real handouts, and
the wizard generates from that same set.

---

## The gaps — four places the app substituted its own word for yours

### 1. `ground` — your word is **Earth**
> *"Earth, Seeding"*

"Ground" is the generic arc word (every meditation framework has a
"grounding" phase). **Earth** is elemental, concrete, and yours. It also pairs
with Water below — the handout is running an elemental progression the app
flattened into process language.

### 2. `wash` — your word is **Water**
> *"Water, Watering the soil"*

Same substitution, and this one has a second problem (below). "Wash" is
borrowed from sound-healing marketing copy — *sound wash*, *sound bath* — which
is exactly the register the brand avoids everywhere else.

### 3. `return` — your closing word is **Home**
> *Full Moon in Leo* ends: Chimes / **"Is Home"**

"Return" is an arc-theory word. "Home" is what you actually wrote, it's the last
word of a real session, and it's warmer by a mile. The whole poem reads:
*The rock / What grows / Will live / And shed / What's shed / Will burn /
What's left / **Is Home**.*

### 4. `wash` conflates two different things — and the app contradicts itself
`wash` is assigned to **both** Ocean and Gong. Those are not the same event:
water texture versus struck metal. The app's own element inference knows it —
`textureElements()` maps `/(ocean|wave|sea|water)/ → waves` but
`/(gong|wash)/ → wind`.

**So a Gong section is labelled `wash` (water) while sounding `wind`.** The
function name and the sound disagree inside one section. Meanwhile *Seeding*'s
gong section carries **"Trust, Buried"** — a function word with no slot in the
taxonomy at all.

→ Likely fix: split `wash` into a water function and a metal/gong function.
Candidate names from your own sheets: **Water** and **Trust** (or *Bury*).

### Also noted
- **`arrive` has no real-session provenance.** Both handouts open on a texture
  (*Insects, Big Stick & Poem*), but neither names it "Arrive." The wizard's
  invented "Welcome" / "Arrival" are the app's words, not yours.
- **Only chakras 1, 2 and 4 are reachable.** `ground`/`flow`/`bloom` hard-code
  Root, Sacral and Heart — which correctly encodes *your* practice (both real
  sessions ascend C → D → F). But no function produces a Throat or Third Eye
  section, so the taxonomy is currently fitted to two sessions of one
  practitioner. That's the right starting point and the wrong ending point.
- **Chakra intents need sourcing.** *Security + Groundedness · Creativity +
  Pleasure · Courage + Discipline · Love + Compassion · Connection + Expression
  · Intuition + Wisdom · **Faith + Excitement***. That last one is idiosyncratic
  enough (most sources say consciousness / divine connection) that it reads like
  it came from a real curriculum or your own training rather than a generic
  list — which would be good. **But nobody has confirmed where it came from,
  and it ships in the product.** Verify the source or replace with yours.

---

## Proposed renames — pending your call, nothing applied

| Now | Proposed | Evidence |
|---|---|---|
| Ground | **Earth** | "Earth, Seeding" |
| Wash | **Water** | "Water, Watering the soil" |
| Return | **Home** | "Is Home" |
| *(none)* | **Trust** — split out of Wash for gong/metal | "Trust, Buried" |
| Arrive | *unresolved* | no handout evidence yet |

Renaming is cheap: `FUNCTIONS` keys and `inferFunction()` are the only places
that matter, and section names are stored per-session so no user data breaks.
**The cost of getting it wrong is high and silent** — a taxonomy is the
product's brain, and generic words teach every future practitioner the generic
frame.

---

## The 2024–2025 session review — the real fix

Two sessions is enough to prove the language is yours; it is not enough to
prove the taxonomy is *complete*. BOOK says so directly: the taxonomy is *"the
most important open item... test the hypothesis against the next thirty,"* and
*"sampling beats volume."*

You played these. The data exists and nobody else can produce it.

**Collect per session, easiest first:**
1. **The handout** — photograph both sides, including the handwritten
   annotations. The pen marks are the leader layer and they are the product.
2. **Date, venue, room size, headcount.**
3. **Who played, on what** — the roster, and whether the app's motif would have
   needed to yield.
4. **The section list in order:** name · phrase · key/chakra · minutes ·
   pitched-or-texture.
5. **The title and the poem** — the phrases read down as one sentence.
6. **What changed live** — where you held, where you jumped, what ran long.
   This is the only source for whether HOLD/JUMP/GO-early frequencies match the
   app's assumptions.

**What we extract:**
- Every function word you actually wrote, ranked by frequency → the real taxonomy
- Which sections are pitched vs textural, and the ascent pattern (both known
  sessions run C → D → F — is that invariant or just these two?)
- Typical section counts and durations → better wizard defaults
- Whether "Space" appears as a programmed element elsewhere, or only once
- Whether any session needs Throat / Third Eye / Crown, or whether the
  three-chakra spine is the real practice

**Then:** the taxonomy hardens from a two-session fit into the product's brain,
and every function name in the app is one you wrote first.

---

*Nothing in this audit has been applied. The app's language is safe to ship as
is — it is genuinely yours in the majority of cases — but the four gaps above
are where a generic frame is quietly teaching itself to every future user.*
