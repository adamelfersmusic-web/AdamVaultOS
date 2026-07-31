# You don't need seven bowls

2026-07-31. Adam, on the yoga-teacher on-ramp:

> *You don't even need a whole set of singing bowls. If you had a couple of good
> ones you could pretty much do everything you needed.*

**This is a bigger unlock than it sounds, and Bed already does it — nobody has
ever said so.**

---

## What the app already does

The bowl sheet is computed **per kit, per section.** Given whatever bowls a
person owns, it works out which are free, which are sparing, and which fight the
key — and it renders only what that device's owner actually has. A 7-bowl leader
and an 8-bowl player read the same session and each see their own bowls; that's
tested.

And when a lane has nobody to play it, the drone fills the harmony in. The
Ensemble screen says it in as many words: **"Just you for now. Bed fills the
harmony in."**

So the honest, already-true claim is:

> ### Bed is what makes a small kit enough.

---

## Why this is the on-ramp, not a footnote

A full seven-bowl set is **$1,500–5,000** and it is the reason most people who
want to lead a sound bath never do. It's a wall, and it comes *before* the first
attempt rather than after.

**Two or three bowls is a few hundred dollars.** With Bed holding the floor, the
drone and the place, two bowls in the right keys is a real instrument — because
the thing a small kit can't do is *sustain*, and sustaining is exactly what Bed
was built to do.

That reframes the buyer pool completely:

| | |
|---|---|
| **Today's avatar** | a practitioner with a full kit, who can't hold the structure alone |
| **This one** | a **yoga teacher** with two bowls and a room that already trusts them |

The second group is enormously larger, already has the room, already has the
audience, and is blocked by exactly one thing — **the gear wall this removes.**

---

## What it changes about the copy

Nothing in the product. One sentence that doesn't exist yet:

> **Two bowls and Bed is a sound bath. Seven bowls and Bed is an orchestra.**

And it belongs in the workshop pitch (`the-workshop.md`) more than anywhere:
*"bring whatever bowls you have — two is enough."* That line removes the reason
most people would decline the invitation.

⚠️ **Say it as permission, never as a spec.** *"You don't need seven bowls"*
invites someone in. *"Works with as few as 2 bowls"* is a feature bullet and
sounds like a limitation. Same fact, opposite feeling.

---

## The adjacent thing: Adam plays guitar

> *I'm a piano player and a really sick guitar player — interesting electric
> guitar in Bed could be really cool.*

**Law 4 already covers this and no code is needed.** *Voice is sparse, quiet,
register-separated, and yields to any melodic human in the room.* Turn on **Live
players** and the motif rests — Bed plays only what hands can't, and an electric
guitar with volume swells or an e-bow is precisely the melodic human that law was
written for.

So the rig for Adam's own first night is already supported: **Bed on the floor
and the drone, guitar on top, bowls in the room.** That's not a feature request,
it's the arrangement the engine was designed around.

**It is also the single most differentiated thing he personally brings.** Most
practitioners can't play an instrument at that level. A sound bath with a real
guitarist over a held floor is a *different event*, and the first night in Ohio
is the place to find out how different.

---

## Handpan in Bed — and which one to buy

2026-07-31. Adam: *"I want to get one of those handpans… that would also be sick
in Bed, and no one really uses something like that in a sound bath."*

**Right, and there is a trap worth knowing before spending the money.**

### The conflict nobody would see coming

**A handpan cannot change key. Bed's signature move is changing key.** A handpan
is hammered to one fixed scale — that's the instrument, not a limitation of a
model — so a session that migrates from C to F to A will leave a handpan player
stranded in most of it.

That is a genuine collision between the product's best feature and the
instrument, and it decides *which handpan to buy.*

### The answer: **D Kurd**, and here is the arithmetic

D Kurd gives you **D E F G A B♭ C**. Run it against Bed's seven chakra keys:

| Chakra | Key | D Kurd |
|---|---|---|
| 2 Sacral | **D** | ✅ exact — D minor |
| 4 Heart | **F** | ✅ exact — F major |
| 5 Throat | **G** | ✅ exact — G **dorian** *(already in `MODES`)* |
| 6 Third Eye | **A** | ✅ exact — A phrygian |
| 1 Root | **C** | 🟡 six of seven; only the leading tone B is missing |
| 3 Solar Plexus | **E** | ❌ |
| 7 Crown | **B** | ❌ |

**Five of seven, four of them exact.** That is not a coincidence — it's why D
Kurd is the most common handpan there is. **Build sessions that live in D, F, A,
G and C, and the handpan plays the whole night.**

### And Bed already works this out for you

Enter it as a **custom kit** — `D E F G A Bb C` — and the sheet does the rest.
`buildKit()` parses flats, and the bracket algorithm grades every section as
*freely / sparingly / rest, it fights the key*. **So an E-major section will
simply tell you to rest**, in the same notation the bowls use, without anyone
special-casing anything.

The app was built for bowls and handles a handpan correctly on the first try,
because the sheet was always computed from **pitches you own**, not from bowls.

### Why it's worth doing at all

*"No one really uses something like that in a sound bath"* is the whole point.
The differentiator isn't the handpan — it's that **Bed makes a fixed-key
instrument workable in a session that moves**, which is exactly the problem that
keeps handpans out of these rooms.

### One collection, five roots — and it's *F* major, not C

Adam, immediately: *"mostly the notes of C major if you think about it… and then
one section F major would be the exact notes."*

The instinct is right and the arithmetic sharpens it, in a way that turns a
constraint into a compositional method.

| | |
|---|---|
| **D Kurd** | D E F G A **B♭** C |
| **C major** | C D E F G A **B** |
| **F major** | F G A **B♭** C D E |

**D Kurd isn't *mostly* C major — it *is* F major, exactly.** One note off from
C (B♭ where C wants B), and identical to F.

Which means every "different key" in the table above is **the same seven notes
with the root moved:**

> **D minor · F major · G dorian · A phrygian** — one collection, four centres.

### The method this hands you

A handpan session is therefore **not** "avoid the bad keys." It's:

> ### Keep the collection. Move the root.

That is modal migration rather than modulation, and **Bed already does exactly
this** — mode is chosen per section, and key migration moves the root while the
voices keep their roles. So build:

`D minor → F major → G dorian → A phrygian → back to D`

…and **the room changes character five times while the handpan never has a wrong
note in the entire session.** Nothing to rest, nothing bracketed, no section
where you sit out.

That is the version worth building the first handpan session around — and it's
the clearest possible demonstration of the thing nobody else can offer: **a
fixed-key instrument, in a session that moves.**

*(Add C as a fifth centre if the session wants a brighter room; you lose only the
leading tone, which the drone never plays anyway — law 2 builds root, 4th, 5th,
octave and 9th, and no 7th.)*
