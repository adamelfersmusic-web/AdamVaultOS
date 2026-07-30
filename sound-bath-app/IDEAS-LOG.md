# Idea Log — attributed

Every substantive idea from the originating conversation, marked by source and
grouped by theme rather than chronology.

- **[A]** — Adam. Domain knowledge, product direction, lived experience.
- **[C]** — Claude. Analysis, engineering, pushback, research.
- **[A→C]** or **[C→A]** — one person's idea that the other materially
  sharpened or corrected.

> This is not a verbatim transcript — export the raw thread from the UI for
> that. This is the substance, preserved and attributed.

---

## 1. Origin

- **[A]** Every play-along / practice tool sounds like a 2004 keyboard demo.
  iReal Pro is functionally great and sonically embarrassing. The tone is the
  product.
- **[A]** Most practice happens without bars. Bars are a mode you opt into.
  Drone should be the default frame, not a degenerate case of a chord player.
- **[C]** The progression side is unwinnable — iReal Pro's moat was never the
  software, it's the user-contributed chart library. The drone side is the gap.
- **[A]** Correct, but for a better reason: tonic-relative hearing is the actual
  skill, and a drone is the only way to isolate it. Most world music is
  drone-based; improvisation is largely playing against a series of drones.
- **[A]** Existing workarounds are all bad: hold a pad and hit sustain on a
  looper, or carry a freeze pedal. Sustained-drone mode often isn't even standard
  on loopers.
- **[C]** A phone genuinely wins here for a technical reason that doesn't apply
  to most music apps — **drones have no latency requirement.** Bluetooth's lag
  makes a metronome unusable and a drone completely unaffected.

## 2. The pivot to sound baths

- **[A]** Sound baths are exploding — the new yoga class. Big in Ohio, hosted in
  yoga centers, sold out.
- **[A]** The people in that world often can't program. They love this and
  they'd do anything to lead it, but they're not composers or conductors.
- **[A]** A drone app for sound baths could sell 5–10 units this week locally.
- **[C]** That sentence is the whole asset. Most builders have a product and no
  distribution; warm access to a specific community is the rare half.
- **[C]** That community buys $800 bowls. Price it like gear, not like a
  consumer app. The scene is also unusually uniform nationally — Columbus,
  Asheville, Boulder, Sedona share a vocabulary. Ten sales in Ohio isn't an Ohio
  result.
- **[C]** Different sonic target from the practice app: practice pads are
  self-effacing furniture; a sound bath pad is the foreground art. Architecture
  carries over, voices are new work.
- **[A]** It's customizable wellness music. Sound bath first, then yoga teachers
  who talk over it, then meditation, ecstatic dance pre-meditation, massage.
- **[C]** All one engine with different templates and lengths. **Build four
  templates, market only the sound bath.** A product that announces five markets
  reads as made for nobody.

## 3. The transformation (positioning)

- **[A]** What we're selling is the transformation of the person who loves sound
  into someone who leads these experiences. The app holds space; they move the
  energy. They're the planet, this is gravity.
- **[A]** One violin player becomes a symphony.
- **[C]** Keep that line. Concrete, about them, whole promise in six words.
- **[A]** Even the biggest regional practitioner runs backing tracks with a thin
  palette — the audience doesn't know.
- **[C→A]** True and unsayable. Practitioners *can* tell, and they're the
  buyers. Reframe: *the sound design was never the art — leading the room is.*
  Same fact aimed at their pride instead of the audience's ignorance.
- **[A]** The Thursday story: musicians passing through, no event planned, 15
  minutes of structure, tea and tarot, and Saturday there's a room.
- **[C]** That's the ad, and the app is barely in it. **The promise isn't
  "better sound baths," it's "you can say yes on Thursday."** Which makes
  fifteen minutes a hard spec to test, not a figure of speech.
- **[A]** Closing line: "We made it happen."
- **[C]** Right pronoun. Keep it.

## 4. Founder fit

- **[A]** Fourth-generation musician, tech builder, licensed massage therapist
  who taught in colleges, Reiki since 17. Plays in sound baths.
- **[C]** The credential stack isn't the point — the point is that this product
  requires credibility in two mutually suspicious communities. Wellness thinks
  tech is extractive; music-tech doesn't take sound healing seriously. Almost
  nobody speaks both natively. **De-risks messaging, not product.**
- **[A]** "I'm a real musician so I don't need this, but I know people this
  could be life-changing for."
- **[C]** Both an asset and the specific failure mode. Musicians building for
  non-musicians add flexibility, which feels like generosity and reads as a wall.
  **Dictator about timbre; cowardly about interface.**

## 5. The friend / design partner

- **[A]** Knows the biggest practitioner in the region — sold out every time,
  works with the Columbus Museum of Art and East Forest. Can actually compose.
- **[A]** His entire palette: felt piano, drones, birds, crickets, wave sounds.
  That's it. Plus live improvisers and a light show.
- **[C]** That's the most valuable thing in the conversation. A top practitioner
  independently converged on a five-element palette — that's field validation of
  the closed-palette thesis. **His session is the spec.** And he's not a
  customer, he's the design partner and credibility anchor; the customers are
  the people in his audience thinking "I want to do this and I can't."

## 6. Perform vs. design

- **[A]** Old cue software for backing tracks — trigger the next section, start
  instantly or fade.
- **[C]** QLab (theater standard) and Ableton Session View. And the hard part
  doesn't apply here: cue systems are complex because everything must land on a
  bar line. **No tempo means nothing to quantize to** — the worst engineering
  problem in the category disappears.
- **[C]** **Fade time is ergonomic, not aesthetic.** It's the window in which a
  human sets down one bowl and picks up another. Design around hands.
- **[A]** People build ~4 sound baths and rotate them all year.
- **[A→C]** Correction: some design a new one every few months. The guy started
  repeating and nobody noticed — because he cues live and live players
  improvise.
- **[C]** Which lands on the same conclusion by a better route: **variation
  happens at performance time, not design time.** Perform mode is the product.
- **[C]** Therefore the cue list needs three controls, not one: **HOLD, NEXT,
  JUMP.** Without HOLD the app drives instead of follows.
- **[C]** From the event photos: hands hold mallets, bowls are packed edge to
  edge, the screen sits ~4 ft away at an oblique angle. **Perform mode is
  display-only.** Live mixing in that room is a fantasy without a dedicated
  operator.

## 7. Multi-practitioner sync

- **[A]** Multi-practitioner baths are real — the biggest group in Ohio runs
  4–10 practitioners, synchronized off one person who knows the structure, with
  hand signals for sections.
- **[C]** That reframes the whole product: **it's a conducting tool that happens
  to make sound.** The role already exists; the app removes the gate on it.
- **[C]** Sync is cheap because of one distinction: syncing *audio* across
  devices is brutal (clock drift, jitter); syncing *displays* is trivial. One
  device makes sound, the rest are screens. Quarter-second lag on "section 3" is
  invisible.
- **[C]** Ship suggested hand signals anyway — fewer screens in a dark room, and
  **if the app defines the signals the app becomes the standard.** Social moat.
- **[C]** Economics: one leader license, N followers. Group product. Nine people
  experience it from the inside every session.
- **[A]** Every section/note has a color; all connected screens change when the
  master changes section. Follower screen shows section, key, allowed bowls, and
  roaming instructions.

## 8. The white sheet (the core discovery)

- **[A]** Bowl players get a printed sheet per session listing which bowls are
  allowed per section, **by bowl number, not by note** — they don't read music.
- **[C]** Products that digitize an existing artifact adopt far faster than
  products that invent a behavior. **The sheet is the follower screen** —
  identical content, one printed and static, one live on a phone.
- **[A]** *(supplied two real sheets)* Notation is `BOWL 1 3 5 (2 4 6) [7]` —
  bold root, plain, parens, brackets.
- **[C]** Verified the bracket rule across three real sections: **every bracket
  is exactly the bowl that contradicts the stated mode.** C mixo → `[7]` = B♮
  (wants B♭); D maj → `[1,4]` = C♮,F♮ (wants C♯,F♯); F maj → `[7]` = B♮ (wants
  B♭). That's computable, not a taste call.
- **[C]** Reinforce tiers **visually** (size + brightness), not verbally. Words
  become a legend, not the mechanism. Readable at 15 ft, in the dark, in any
  language.
- **[C]** From the sheets: **the chakra determines the key, not the reverse.**
  Bowl number = chakra number = scale degree in C, all at once. That's why C, D,
  F dominate — Root, Sacral, Heart. The app should never ask for a key.
- **[C]** From the sheets: sections **alternate pitched and textural**, with
  *Space* programmed as an element. Both observed sessions ascend C→D→F and
  close on a texture.
- **[C]** From the sheets: **every section carries a phrase, and read in order
  they form a sentence** ("The rock / What grows / Will live / And shed…").
  Therefore design mode asks *"what is this section about?"* before anything
  musical.
- **[C]** The handwritten annotations on the printed sheets are live-instrument
  and leader information — **he's manually maintaining the leader/follower split
  in ballpoint because no tool does it.** The gap made visible.

## 9. Harmony and the bowl constraint

- **[A]** Bowl sets are typically C major. Common keys: C, F, sometimes D.
- **[A]** Bowls just drone. Live instruments play I→IV over a static root drone.
- **[A]** Drones should omit thirds — root/fifth/octave or root/fifth/ninth.
- **[C]** Right, and the reason is a product principle: **a third-less drone is
  a permission structure.** It lets live players choose major or minor; stating
  a third decides for the whole room. Why tanpuras are root-and-fifth.
- **[C]** *(initial, wrong)* F→B♭ breaks a C-major bowl set; stay in white-note
  modes.
- **[A→C]** **Correction:** you *tell* the bowls what to play. Bowls hold F and
  C; live instruments move F→B♭; nothing clashes because the B bowl is never
  called. "No one is ripping F Lydian on a singing bowl."
- **[C]** Correct — the bowl set constrains **the instruction, not the engine.**
  Pads and chords can go anywhere as long as each section can name 2–3
  consonant bowls. Rule: *never leave the bowls with nothing to do.* Same check
  governs key migration.
- **[C]** Weight **sustain**, not just interval — a bowl rings 20+ seconds, so a
  passing tension becomes a permanent one.
- **[A]** Separate the drone layer from the chord layer: with live instruments,
  mute the chords and let the humans do it — that's where the magic is.
- **[C]** Make it **one switch**, not a mixer decision. "Live players mode."
  That single toggle encodes the whole philosophy, and it doesn't cost a fifth
  band — chords are a *mode* of the Bed.

## 10. Sound design

- **[A]** Nobody in the space has subs. Add a deep layer and you're world-class
  in a way nobody is. A "deep pulse engine."
- **[C]** True, and there's a physics reason: crystal bowls produce essentially
  nothing below ~200 Hz. **The bowls own the mids and top; the app owns the
  floor.** The app isn't backing music, it's the missing half of the spectrum.
- **[C]** Caveat: Bluetooth speakers roll off around 80–100 Hz. Tiered promise +
  missing-fundamental harmonics for small speakers. **Name a specific speaker** —
  it's the only hardware in the system.
- **[C]** *Pulse* is the better instinct than a static sub — a slow swell near
  six cycles/minute sits at the coherent-breathing rate.
- **[C]** Allocate by **frequency band, not track count**: Deep / Bed / Voice /
  Air. Mud comes from frequency collision, not track quantity. Answers "are
  waves and crickets the same track" — both are Air.
- **[A]** In live settings the pads are in the mids but subtle. **Build the app
  around the bowls being the thing.**
- **[C]** Concrete rule: **the app holds still in the bowl range; the bowls do
  all the motion.** Sparse and static in the middle, rich below and above.
- **[A]** No PA, no mics — bowls are acoustically loud. The LED pads under the
  bowls are lights, not microphones.
- **[C]** Then the app is the *only* thing needing amplification. One source,
  one speaker, no mixer, no feedback. "Your bowls and one speaker."
- **[A]** Palette: pads, crickets, waves, wind, chimes, rain sticks, wave drum,
  sub. Flute questionable.
- **[C]** Agree on flute — needs breath and articulation, synthetic flute is
  instantly fake, and one bad voice makes the whole palette feel cheap. Rain
  stick and wave drum are noise-and-resonance, very synthesizable. Birds are the
  one thing pushing toward samples; cutting them keeps the product fully
  generated.
- **[A]** The Steven Halpern / 90s massage-album electric piano sound.
  *(Originally recalled as "Joseph Goldman.")*
- **[C]** Likely conflating Jonathan Goldman with **Steven Halpern** — *Spectrum
  Suite* is the reference for that sustained Rhodes timbre. Very synthesizable.

## 11. The four laws

- **[C]** Proposed: stability comes from subtraction — no pulse, no third in the
  drone, no automated dynamics, no competing melody.
- **[A]** "No pulse ever. No third in drone ever. Yes no automated dynamics. No
  competing melody. Exactly."
- **[C]** Two consequences: **the arc comes from arrangement, not automation**
  (you get bigger by a layer entering, a discrete event humans can play
  against); and **no pulse means no tempo anywhere** — sections in minutes, no
  BPM, no grid, no quantized launch. A real architectural fork from the practice
  app.
- **[C]** Design target that will feel wrong every time: **the best compliment
  the bed can get from an improviser is that they forgot it was there.**
- **[C]** One conflict to settle: ecstatic dance has a pulse. Let the law win —
  different mode at best, probably a different product.

## 12. Key migration

- **[A]** When you change key, it gradually shifts all your material to the new
  key.
- **[C]** **That's the demo** — ten seconds, sells the whole thing, impossible
  acoustically and impossible with recordings. Only works because everything is
  generated. The moat in one move.
- **[C]** Execution: **common tones don't move at all**; stagger the rest over
  20–30 s. Never glide everything at once — that's a portamento swoop, cool
  twice and nauseating on a floor of closed eyes. The practice looper's
  nearest-voice engine already solves this.

## 13. Templates, wizard, taxonomy

- **[A]** A few common structures as templates; a guide that asks how long, is
  there talking, how long people marinate. "An AI that doesn't feel like AI —
  a benevolent healing support guide."
- **[C]** Take it further: **it shouldn't be AI at all.** Four or five questions
  deterministically produce a structure. A decision tree is instant, offline,
  free, never says anything weird — and *feels more magical*, because magic in
  an interface is immediacy.
- **[C]** **Never use the word "AI"** in this market. It signals inauthentic and
  extractive. Call it planning the arc, or just ask the questions.
- **[A]** We'd need to define the canonical functional sections by studying real
  sound baths — **that would be the intelligence driving the whole product.**
- **[C]** Correct, and it should be at the top of the document rather than the
  bottom. Everything derives from it, current dataset is two sheets, and it's
  the one thing nobody can shortcut.

## 14. Marketplace

- **[A]** Splice but way simpler. Curator identities (AtmosFly) with named packs
  (Venus, Mars), each pack containing coherent *sections* rather than one track.
- **[C]** **Packs must be presets, not audio.** Rendered audio can't transpose
  with the room — the first purchase would break key migration. As parameters:
  kilobytes not megabytes, no CDN, 432/440 is a field not a product variant,
  and purchased material migrates with everything else. **Splice ships
  gigabytes; this ships JSON.**
- **[C]** **Build the pack format now** even though the marketplace is years
  away — the templates *are* packs, same file type. Cheap now, re-architecture
  later.
- **[C]** Cold-start: the house makes the first inventory. 3–4 in-house curator
  identities = a populated shelf on day one without pretending.
- **[A]** East Forest and Jon Hopkins aren't on Splice. Start with local
  legends — the biggest person in each regional scene writes a pack and becomes
  an affiliate.
- **[C]** Revenue note: 4-ish sessions a year means packs are **closer to buying
  another bowl than to a subscription.** Real revenue, wrong model as churn.

## 15. Lights and hardware

- **[A]** A companion app runs the lights, synced to the sections. Eventually a
  small recommended PA with a couple of inputs for live instruments.
- **[C]** **Build the cue engine as an event broadcaster from day one.** Lights,
  follower phones, and projection are all subscribers. Nearly free now, painful
  to retrofit.
- **[C]** Lights never hang off the audio path — analyzing a signal is fuzzy and
  dumb when the app already knows it's entering section 4 in F.
- **[A]** The LED pads under the bowls are a cool add-on.
- **[C]** **Those are lighting v1.** Already in the room, already bought,
  spatially better than overhead (they light the instrument and the face from
  below), and a handful of Bluetooth pucks is a completely different problem from
  DMX. Section color broadcast to the pads = **the bowls become the light show.**
- **[C]** Never manufacture a speaker — heavy, and freight-plus-damage economics
  eat small companies. Sequencing: **recommend → affiliate → bundle.** If
  anything ever carries the brand physically, make it the LED pads.
- **[C]** **Pull the live inputs forward** — not future, not hardware. An iPad +
  a ~$100 USB interface is two inputs, and the win is **shared reverb**: the
  live violin stops sounding like it's on top of the track and starts sounding
  like it's inside the piece.

## 16. Aesthetics

- **[A]** Silver-white with subtle purple and orange. *(later:)* Lumen by Kompose
  Audio as a reference.
- **[C]** Steal from Lumen: the four-strip anatomy (it's already the four-band
  design), near-monochrome restraint, thin high-contrast serif over functional
  sans. **Invert the value** — it's a light UI for a bright studio and this runs
  in a candlelit room. Kill the fantasy naming, the tab bar, the keyboard
  graphic.
- **[C]** Make the hero area **live** — in Lumen it's a static JPEG; here it
  should be the four bands drifting, breathing, and visibly migrating on key
  change. Decoration becomes instrument.
- **[C]** From the event photos: rooms are washed warm amber, so **warm section
  colors vanish and cool ones survive.** Screens drop to dim amber/red once a
  session starts.
- **[C]** Color should trace the **arc**, not label sections arbitrarily —
  indigo on arrival, warming through, cooling to rose at the marination. And
  never let color be the only carrier; ~1 in 12 men has some color deficiency.
- **[A]** Maybe each section's color corresponds to its chakra.
- **[C]** *Tension:* chakra hues are semantically perfect and half of them
  disappear in a candlelit room. Proposed split — chakra color on the **LED
  pads** (light source), cool arc on **screens** (read at distance). Unresolved.

## 17. Market research (Claude, verified)

- Consumer listening is crowded: The Sound Bath App, PAUSE (Sara Auster),
  Insight Timer, Sound Bath Journeys. All *lie down and receive*.
- Business software for healers exists: Flowdara, Breely, Acuity, ZenPass.
  Built for the calendar, not the room.
- Generative engines exist for musicians: **Wotja** (130+ parameters — the
  thesis in one object), **Endel** (automatic, biometric, zero authorship).
- **Nothing exists for the fifty minutes a practitioner is in front of a room.**
  Not failing — empty.
- Why: everyone chased listeners because that market is millions. A few thousand
  practitioners at a few hundred dollars is a good business and a terrible
  venture business. **Nobody funded is coming.**

---

## Corrections made during the conversation

Recorded because they're the places the thinking actually moved.

| Claim | Correction | By |
|---|---|---|
| Bowls in the photo are mic'd; audio goes to a desk | Those are LED pads; bowls are acoustically loud, there's no PA — which means the app is the *only* thing needing amplification | **[A]** |
| F→B♭ breaks a C bowl set; stay in white-note modes | You tell the bowls what to play; F and C hold fine under F→B♭. The set constrains the instruction, not the engine | **[A]** |
| Practitioners build ~4 sessions and run them all year | Range is wider; some rebuild often. But repeats go unnoticed because variation happens live | **[A]** |
| Adopt "Root / Also / Occasional" verbatim | Those terms aren't actually standardized in the field; the real sheets use **punctuation tiers**, which are better than any vocabulary | **[A→C]** |
| Lights are the biggest scope risk, defer entirely | Still true for venue rigs — but LED bowl pads are already in the room and are a far better v1 | **[A→C]** |
