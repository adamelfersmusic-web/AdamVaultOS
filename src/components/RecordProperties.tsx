// The row-as-page property panel. When a note belongs to a database (a task),
// opening it as a page shows the database's fields as EDITABLE properties at
// the top — click an enum chip to pick a value, toggle a bool, type a URL —
// with the free-form body below. A task and a note become the same object.
//
// Every change is a metadata-only write via setMetadata (optimistic + undo +
// self-healing concurrency). The body editor adopts the bumped updatedAt when
// it has no unsaved changes, so property edits never false-conflict a save.

import { useEffect, useRef, useState } from 'react'
import type { DatabaseDef, FieldDef, Note } from '../lib/types'
import { setMetadata } from '../lib/store'
import { Chip, chipFor } from './Chip'
import { Popover } from './Popover'
import { IconCheck } from './Icons'

export function RecordProperties({
  note,
  def,
  variant = 'full',
}: {
  note: Note
  def: DatabaseDef
  variant?: 'full' | 'peek'
}) {
  return (
    <div className={`record-props record-props--${variant}`} data-testid="record-props">
      {variant === 'full' && <div className="record-props-label">{def.title} · properties</div>}
      <div className="record-props-grid">
        {def.fields.map((field) => (
          <div className="prop-row" key={field.key}>
            <span className="prop-label">{field.label}</span>
            <div className="prop-control">
              {field.kind === 'text' ? (
                <TextProp field={field} note={note} />
              ) : field.kind === 'bool' ? (
                <BoolProp field={field} note={note} />
              ) : (
                <EnumProp field={field} note={note} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function write(note: Note, key: string, value: unknown) {
  const prev = note.metadata[key]
  if ((value ?? null) === (prev ?? null)) return
  void setMetadata(note.path, { [key]: value }, { undo: { [key]: prev ?? null } })
}

function EnumProp({ field, note }: { field: FieldDef; note: Note }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const value = note.metadata[field.key]
  const chip = chipFor(field, value)
  const cur = value == null ? '' : String(value)

  const declared = (field.options ?? []).map((o) => o.value)
  const values = cur && !declared.includes(cur) ? [cur, ...declared] : declared

  const pick = (v: string | null) => {
    setOpen(false)
    write(note, field.key, v)
  }

  return (
    <>
      <button
        ref={btn}
        className="prop-chip-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
      >
        <Chip color={chip.color} label={chip.label} empty={chip.empty} />
      </button>
      {open && btn.current && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)} width={200}>
          {values.map((v) => {
            const c = chipFor(field, v)
            return (
              <button
                key={v}
                className={`menu-item${v === cur ? ' is-current' : ''}`}
                onClick={() => pick(v)}
              >
                <Chip color={c.color} label={c.label} />
                {v === cur && <IconCheck size={14} className="menu-check" />}
              </button>
            )
          })}
          {cur && (
            <button className="menu-item prop-clear" onClick={() => pick(null)}>
              <span className="menu-item-text">Clear</span>
            </button>
          )}
        </Popover>
      )}
    </>
  )
}

function BoolProp({ field, note }: { field: FieldDef; note: Note }) {
  const v = note.metadata[field.key] === true
  const chip = chipFor(field, v)
  return (
    <button
      className="prop-chip-btn"
      onClick={() => write(note, field.key, !v)}
      aria-pressed={v}
    >
      <Chip color={chip.color} label={chip.label} empty={chip.empty} />
    </button>
  )
}

function TextProp({ field, note }: { field: FieldDef; note: Note }) {
  const stored = note.metadata[field.key]
  const [val, setVal] = useState(stored == null ? '' : String(stored))
  useEffect(() => {
    setVal(stored == null ? '' : String(stored))
  }, [stored])

  const commit = () => {
    const next = val.trim()
    write(note, field.key, next || null)
  }
  const href = /^https?:\/\//i.test(val.trim()) ? val.trim() : null

  return (
    <div className="prop-text">
      <input
        className="prop-input"
        value={val}
        placeholder={`Add ${field.label.toLowerCase()}…`}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      {href && (
        <a className="prop-open" href={href} target="_blank" rel="noreferrer" title="Open link">
          ↗
        </a>
      )}
    </div>
  )
}
