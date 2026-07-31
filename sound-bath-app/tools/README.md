# tools

Checks for the parts of Bed whose only reader is a machine.

```sh
node tools/qr-check.cjs      # ~0.6s, no dependencies, no network
```

Run it before any commit that touches the QR encoder in `app/index.html`.
Green means the encoder is byte-identical to an independent implementation
across all 48 version × mask configurations, and the app's own read-back check
refuses every possible single-module corruption.

---

## Why this exists

v1.16's first working QR encoder produced symbols with **correct finders,
correct timing, and byte-identical data.** Twelve modules out of 841 were
wrong — all of them format bits, the two copies transposed. The output looked
completely normal.

No scanner on earth could read it.

**That is the whole problem in one sentence: a wrong QR has no visible failure
mode.** It doesn't throw, it doesn't warn, it doesn't look broken. You find out
when forty people point their phones at it and nothing happens, in a dark room,
ninety seconds before you were going to start.

---

## Three layers, and what each one actually catches

Each catches something the others cannot. None is sufficient alone, and the
measurement below is not rhetorical — the bug was put back in to check.

### 1 · `qrVerify()` — ships inside the app, runs on every code

Reads the finished matrix back the way a scanner would: recovers the format
word, checks its BCH, requires the two copies to agree, unmasks with the mask
it just recovered, re-walks the zig-zag, de-interleaves, runs the Reed–Solomon
syndromes, and compares the decoded payload to the string that went in. **If
anything fails, `qrEncode` returns null and the dialog shows the link instead**
— never a code that doesn't work.

- **Catches:** a bad string, a URL that crosses a version boundary nobody
  tested, a mask branch never taken before, a block interleave that only breaks
  at 2 or 4 blocks, an encoder edited in a hurry a year from now. Anything the
  data does — on the actual device, for the actual link, forever.
- **⚠️ Does not catch:** a shared misunderstanding of the geometry. If the
  format coordinates are wrong, this reads them back from the same wrong place
  and agrees with itself. **A misunderstanding cannot audit itself.**
- **Measured:** with the real v1.16 bug reinstated, this layer alone refused
  72 of 144 cases and passed the other 72. It would have shipped the bug half
  the time.

### 2 · `qr-check.cjs` + `qr-golden.json` — the outside opinion

144 matrices from `npm qrcode`, an implementation with no relationship to ours,
pinning **all 6 symbol versions × all 8 masks**. Plus: every single-module
corruption must be refused (2,210 flips, all of them), the wrong string must be
refused, over-capacity strings must be refused rather than truncated.

- **Catches:** exactly the class layer 1 can't — us being confidently wrong
  about what the format says.
- **Measured:** with the bug reinstated, 0 of 144 matched. 200 failures.
- **Costs:** 0.6 seconds and zero dependencies at check time. The reference
  library is needed only to *regenerate* the goldens, which should approximately
  never happen.

### 3 · The optical check — a real decoder on a real screenshot

Render the app, screenshot the share dialog at phone resolution, decode the
PNG with a third-party library. This is the only layer that tests the *pixels*
— SVG rendering, contrast, module size, the card's quiet zone — rather than the
matrix. Run by hand when the QR's appearance changes; it needs Playwright and a
decoder, so it deliberately isn't the gate.

### 4 · One phone, before the first session

Nothing above proves a real camera reads a real screen. Scan it once, on the
device you'll actually use, before it matters. This never stops being the last
word.

---

## ⚠️ The rule about `qr-golden.json`

> **Never regenerate the goldens to make a failing check pass.**

They are the only opinion in this repository that wasn't formed in our own
head. Regenerating them from our own output converts the check into a mirror,
and a mirror agrees with everything. If `qr-check.cjs` goes red, **the app is
wrong until proven otherwise** — and if it turns out the app really is right
and the reference is wrong, that belongs in a commit message and a comment, not
in a quiet `node qr-golden-generate.cjs`.

The generator (`qr-golden-generate.cjs`) is checked in for reproducibility and
because two things in it are non-obvious and were both discovered by getting
them wrong:

- **Byte mode must be forced.** Left alone the reference splits a string into
  numeric / alphanumeric / byte segments and emits a smaller, different, and
  equally valid symbol. Comparing against that compares two right answers and
  calls ours wrong.
- **Mask choice is deliberately not pinned.** The spec's penalty rules are read
  slightly differently by every implementation; two encoders can choose
  different masks and both be completely correct. So every mask is pinned and
  the choice among them is left free. A gate that cries wolf gets switched off.

---

## The generalisation

The QR is the first thing in Bed whose only reader is a machine we don't own.
It won't be the last — the sync wire format, exported sessions, WLED packets,
MIDI. They all share the shape:

> ## We write it, someone else's machine reads it, and if we're wrong nothing complains.
> ### So read it back before you show it, and hold it against an opinion formed outside your own head.
