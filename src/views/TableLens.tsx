import { relativeTime, fullTime } from '../lib/format'
import { dueTone, formatDue } from '../lib/dates'
import { isProtectedNote } from '../domain/scripts'
import { ChipSelect } from '../components/EnumMenu'
import { IconPage, IconShield } from '../components/Icons'
import type { LensProps } from './DatabaseView'

const FLAG_COLUMNS = ['declined', 'approval_required']

export function TableLens({
  def,
  rows,
  observed,
  saving,
  onOpen,
  setField,
  sort,
  onSort,
}: LensProps & {
  sort: { key: string; dir: 1 | -1 }
  onSort: (key: string) => void
}) {
  const columns = [...def.tableColumns, ...FLAG_COLUMNS]

  const header = (key: string, label: string) => (
    <th key={key} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button className="th-btn" onClick={() => onSort(key)}>
        {label}
        {sort.key === key && (
          <span className="th-dir">{sort.dir === 1 ? '↑' : '↓'}</span>
        )}
      </button>
    </th>
  )

  return (
    <div className="table-wrap">
      <table className="db-table">
        <thead>
          <tr>
            {header('title', 'Title')}
            {columns.map((key) => {
              const f = def.fields.find((x) => x.key === key)
              return f ? header(f.key, f.label) : null
            })}
            {header('updated', 'Updated')}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isSaving = (saving[row.path] ?? 0) > 0
            return (
              <tr key={row.path} className={isSaving ? 'is-saving' : undefined}>
                <td className="cell-title">
                  <button
                    className="row-peek"
                    title="Open beside the tracker"
                    data-testid="row-peek"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpen(row.path)
                    }}
                  >
                    <IconPage size={12} />
                  </button>
                  <span
                    className="row-ember"
                    data-status={String(row.note.metadata['status'] ?? '')}
                    aria-hidden="true"
                  />
                  <span className="cell-title-text">{row.title}</span>
                  {isProtectedNote(row.note) && (
                    <span className="canon-mini" title="Founder canon — human-gated">
                      <IconShield size={11} />
                    </span>
                  )}
                </td>
                {columns.map((key) => {
                  const f = def.fields.find((x) => x.key === key)
                  if (!f) return null
                  const value = row.note.metadata[f.key]
                  // Date fields render as quiet toned text, not a chip menu:
                  // overdue = calm red, today = the gem accent, else muted.
                  if (f.kind === 'date') {
                    const due = typeof value === 'string' && value ? value : null
                    return (
                      <td key={key} className="cell-due">
                        {due ? (
                          <span className={`due-cell due-${dueTone(due)}`} title={due}>
                            {formatDue(due)}
                          </span>
                        ) : (
                          <span className="due-cell due-unset">—</span>
                        )}
                      </td>
                    )
                  }
                  return (
                    <td key={key} className="cell-chip-td">
                      <ChipSelect
                        field={f}
                        value={f.kind === 'bool' ? value === true : value}
                        observed={observed.get(f.key)}
                        saving={isSaving}
                        onPick={(v) => setField(row.path, f.key, v, value)}
                      />
                    </td>
                  )
                })}
                <td className="cell-updated" title={fullTime(row.note.updatedAt)}>
                  {relativeTime(row.note.updatedAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="table-empty">Nothing matches the current filters.</div>
      )}
    </div>
  )
}
