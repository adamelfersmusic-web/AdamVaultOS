# Voicing — spreading players across the set

2026-07-31. Filed at the end of a long session, while the reasoning is intact.
**Not built, and deliberately not built tonight.**

---

## First, the correction that started it

Adam asked whether the sheet tells each person something *different*. **It does
not**, and I had implied otherwise.

```js
sheetFor(session, section, buildKit(store.settings.kit))
```

The sheet is computed from **the pitches that device owns.** So:

- Different kits → different sheets. *(7-bowl vs 8-bowl vs handpan.)*
- **Same kit → the same sheet.** Twenty practitioners with standard sevens all
  see `4 6 1`.

**Bed does not divide parts among people.** It never has. The earlier phrasing —
*"tells every player what to do right now"* — is true but reads as *different
parts*, and that oversold it.

### Why twenty identical sheets still works

**No pulse.** Twenty people playing freely from the same three bowls don't land
together — nobody is told *when*, so nothing is unison. It's a wash.

The sheet at twenty is doing exactly one job: **keeping everyone inside the right
pitch set as the key moves.** That's already the thing that stops twenty people
grinding against a key change. It is not orchestration.

---

## The feature: voicing

At twenty players the real enemy isn't wrong notes — **it's mud**, and mud comes
from everyone crowding the same two or three pitches.

> **Spread the players across the available set.**

You're weighted toward 4. The person next to you toward 6. Someone else toward 1.
Same session, same key, same laws — **a chord instead of a smear.**

### Why it's legal

**Voicing says *which*. It never says *when*.** Law 1 is untouched, because no
timing is ever transmitted. It's telling someone they're an alto, not conducting
them.

### The design that keeps it honest — and it needs no new vocabulary

**Do not assign. Re-weight.**

The bracket system already has three tiers. Voicing simply changes *which tier a
given bowl lands in, per person:*

| | |
|---|---|
| **large** | your emphasis this section |
| **(mid)** | still playable, still yours if you want it |
| **[small]** | fights the key — rest |

So **nothing is forbidden to anybody.** You can always play anything that fits
the key; the emphasis just differs across the room. The feature is invisible *as
a feature* — it looks exactly like the sheet you already had.

**That is the whole design.** If it ever becomes "you play 4" it has crossed the
line; while it remains "4 is big on your sheet," it hasn't.

### It needs no identity, and that matters

Followers are anonymous — a random `fid`, no account, no name. **Assignment can
run purely on anonymous join order:** the room knows it has eleven devices, and
each device knows it's the fourth to arrive. That's enough to spread them.

**No roster, no names, no accounts, nothing to store.** The sovereignty promise
survives intact, which it would not if this needed to know who anyone was.

---

## ⚠️ The line this crosses, stated so it's crossed deliberately

**This is the first time Bed would differentiate between people.**

Everything the product does today is addressed to *the room* — the same session,
the same key, the same arc, filtered only by what instrument you happen to hold.
Voicing is the first mechanism where **two people holding identical instruments
are shown different things.**

That is a real crossing of *the hero is always the person*, and it is defensible
only under strict conditions:

- **Never enforcement.** Nothing is greyed out, disabled, or wrong to play.
- **Never a name.** No *"Sarah: bowl 4"* on any screen, ever. The moment a person
  is named, the room has a hierarchy and the software put it there.
- **Never leader homework.** It cannot become a thing to manage at 7pm. Automatic
  or it doesn't ship.
- **Never announced mid-session.** No "your part has changed." It is just what
  your sheet says at the next section.

**If it can't hold all four, don't build it.** A slightly muddy twenty-person
room is a much smaller problem than a product that started telling people what to
do.

---

## Where it sits

**After the relay, the first night, and lamp mode.** It is worth less than any of
those and it is the only one that touches the posture.

And there's a cheap way to learn whether it's needed at all: **run the first
night with twenty identical sheets and listen.** If it's a wash and it's
beautiful, voicing is a solution to a problem the room doesn't have. If it's mud,
the note is here.
