// CSV/TSV ↔ table plumbing, pure and editor-free: strict tabular detection
// for paste-to-table, TipTap table JSON for insertion, and CSV serialization
// for the copy-as-CSV trip back to Sheets/Notion. Detection errs toward "not
// tabular" — a false table on paste is worse than leaving text alone.

/** Parse `text` as TSV or comma-CSV. Returns rows, or null when not
 * confidently tabular. TSV wins when EVERY non-empty line has a tab
 * (Sheets/Notion copies — high confidence); ragged TSV rows are padded.
 * CSV is quote-aware (RFC-4180-ish: "quoted fields", "" escapes, commas and
 * newlines inside quotes) and confident only when every row parses to the
 * SAME column count with at least `minCols` columns (2 by default; the
 * explicit /table-from-csv modal relaxes to 1). */
export function parseDelimited(text: string, minCols = 2): string[][] | null {
  const norm = text.replace(/\r\n?/g, '\n')
  const lines = norm.split('\n').filter((l) => l.trim() !== '')
  if (lines.length === 0) return null

  if (lines.every((l) => l.includes('\t'))) {
    const rows = lines.map((l) => l.split('\t').map((f) => f.trim()))
    const width = Math.max(...rows.map((r) => r.length))
    return rows.map((r) => (r.length < width ? [...r, ...Array<string>(width - r.length).fill('')] : r))
  }

  const rows = parseCsv(norm)
  if (!rows || rows.length === 0) return null
  const width = rows[0].length
  if (width < minCols) return null
  if (!rows.every((r) => r.length === width)) return null
  return rows
}

/** Strict quote-aware comma-CSV. Null on anything malformed (stray quote
 * mid-field, unterminated quote) — malformed means "not confidently CSV". */
function parseCsv(text: string): string[][] | null {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false // this field was "..."-wrapped
  let inQuotes = false
  let i = 0

  const pushField = () => {
    row.push(quoted ? field : field.trim())
    field = ''
    quoted = false
  }
  const pushRow = () => {
    pushField()
    // A truly blank line parses as one empty field — skip it.
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
  }

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      // An opening quote is only valid at the start of a field (whitespace
      // before it is fine); a quote after content is malformed.
      if (quoted || field.trim() !== '') return null
      field = ''
      quoted = true
      inQuotes = true
      i++
      continue
    }
    if (quoted && c !== ',' && c !== '\n') {
      if (c.trim() !== '') return null // junk after a closing quote
      i++ // whitespace between closing quote and delimiter
      continue
    }
    if (c === ',') {
      pushField()
      i++
      continue
    }
    if (c === '\n') {
      pushRow()
      i++
      continue
    }
    field += c
    i++
  }
  if (inQuotes) return null
  pushRow()
  return rows
}

interface TableCellJSON {
  type: 'tableHeader' | 'tableCell'
  content: [{ type: 'paragraph'; content?: [{ type: 'text'; text: string }] }]
}

/** Rows → TipTap table JSON; row 1 becomes header cells. Standard table/
 * tableRow/tableHeader/tableCell nodes, so the GFM pipe-table markdown
 * round-trip (Adam's law) holds for free. */
export function rowsToTableJSON(rows: string[][]) {
  return {
    type: 'table',
    content: rows.map((cells, r) => ({
      type: 'tableRow',
      content: cells.map(
        (text): TableCellJSON => ({
          type: r === 0 ? 'tableHeader' : 'tableCell',
          content: [
            text
              ? { type: 'paragraph', content: [{ type: 'text', text }] }
              : { type: 'paragraph' },
          ],
        }),
      ),
    })),
  }
}

/** Rows → CSV text. Fields with a comma, quote, or newline get quoted with
 * "" escapes; everything else stays bare. */
export function tableRowsToCsv(rows: string[][]): string {
  return rows
    .map((r) =>
      r.map((f) => (/[",\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f)).join(','),
    )
    .join('\n')
}
