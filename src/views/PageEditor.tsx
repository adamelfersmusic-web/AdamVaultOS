// The page canvas. A Tiptap editor whose storage is ALWAYS markdown, so page
// notes stay interoperable with Library search, Graph, and NotePage. Mirrors
// NotePage's write discipline — a baseRef of { content, updatedAt }, optimistic
// concurrency via saveContent, the conflict bar, setRouteGuard + beforeunload —
// but the editing surface is blocks (slash menu, drag handles, /ai, /voice).

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Markdown } from '@tiptap/markdown'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import type { Note } from '../lib/types'
import {
  ContentDivergedError,
  createPage,
  deletePage,
  fetchNote,
  forceContent,
  getState,
  linkNoteAttachment,
  saveContent,
  toast,
  uploadImage,
  useStore,
} from '../lib/store'
import { navigate, setRouteGuard } from '../lib/router'
import { relativeTime, titleFromPath } from '../lib/format'
import { databaseForPath } from '../domain/databases'
import { RecordProperties } from '../components/RecordProperties'
import { getSettings } from '../lib/editorSettings'
import { transcribe } from '../lib/scribe'
import { Modal } from '../components/Modal'
import { IconMic, IconPage, IconPlus, IconTrash } from '../components/Icons'
import { SubPageLink, convertPageLinks } from '../editor/extensions/SubPageLink'
import { WikiLink, convertWikiLinks } from '../editor/extensions/WikiLink'
import { MarkdownLiteral } from '../editor/extensions/markdownLiteral'
import { VaultImage } from '../editor/extensions/VaultImage'
import { AiBlock } from '../editor/extensions/AiBlock'
import { SlashCommand } from '../editor/extensions/SlashCommand'

type Status = 'loading' | 'ready' | 'missing' | 'error'
type Rec = 'idle' | 'recording' | 'transcribing'

const SAVE_DEBOUNCE = 900

export function PageEditor({ path }: { path: string }) {
  const { saving, notes } = useStore()
  const note = notes[path]
  const [status, setStatus] = useState<Status>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<Note | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [subPageAt, setSubPageAt] = useState<number | null>(null)
  const [rec, setRec] = useState<Rec>('idle')
  const [dirty, setDirty] = useState(false)

  const baseRef = useRef<{ content: string; updatedAt: string } | null>(null)
  const loadingRef = useRef(true)
  const saveTimer = useRef<number | null>(null)
  const onUpdateRef = useRef<() => void>(() => {})
  const flushRef = useRef<() => void>(() => {})
  const recRef = useRef<{ recorder: MediaRecorder; stream: MediaStream } | null>(null)
  const voiceStartRef = useRef<() => void>(() => {})
  // Image upload: handleDrop/handlePaste and the /image picker all funnel here.
  const uploadImageRef = useRef<(file: File, at?: number) => void>(() => {})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImageAt = useRef<number | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      VaultImage, // resolves /api/storage vault paths (auth-safe); no base64
      Markdown,
      MarkdownLiteral,
      SubPageLink,
      WikiLink,
      AiBlock,
      SlashCommand.configure({
        onPickSubPage: (_editor, at) => setSubPageAt(at),
        onVoice: () => voiceStartRef.current(),
        onUploadImage: (_editor, at) => {
          pendingImageAt.current = at
          fileInputRef.current?.click()
        },
      }),
    ],
    editorProps: {
      attributes: { class: 'page-prose' },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (files.length === 0) return false
        event.preventDefault()
        const at = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos
        for (const f of files) uploadImageRef.current(f, at)
        return true
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (files.length === 0) return false
        event.preventDefault()
        for (const f of files) uploadImageRef.current(f)
        return true
      },
    },
    content: '',
    onUpdate: () => onUpdateRef.current(),
  })

  const isSaving = (saving[path] ?? 0) > 0

  // ——— save pipeline ———
  const flushSave = async () => {
    const base = baseRef.current
    if (!editor || !base) return
    const md = editor.getMarkdown()
    if (md === base.content) {
      setDirty(false)
      return
    }
    try {
      const updated = await saveContent(path, md, base)
      baseRef.current = { content: updated.content ?? md, updatedAt: updated.updatedAt }
      setDirty(false)
      setConflict(null)
    } catch (e) {
      if (e instanceof ContentDivergedError) setConflict(e.fresh)
      else toast('error', `Couldn’t save — ${e instanceof Error ? e.message : e}`)
    }
  }
  flushRef.current = flushSave

  // A property-panel edit (setMetadata) advances the vault's updatedAt without
  // touching the body. When there are no unsaved body changes, adopt the new
  // stamp so the next body save doesn't false-conflict on a stale precondition.
  useEffect(() => {
    const b = baseRef.current
    if (b && !dirty && note && note.updatedAt !== b.updatedAt) {
      baseRef.current = { content: b.content, updatedAt: note.updatedAt }
    }
  }, [note?.updatedAt, dirty])

  // Keep the (stable) onUpdate handler pointed at the latest closure.
  useEffect(() => {
    onUpdateRef.current = () => {
      if (loadingRef.current || !baseRef.current || !editor) return
      const md = editor.getMarkdown()
      setDirty(md !== baseRef.current.content)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null
        void flushSave()
      }, SAVE_DEBOUNCE)
    }
  })

  // ——— load (once per mounted path; PagesView remounts via key) ———
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    loadingRef.current = true
    setStatus('loading')
    setLoadError(null)
    setConflict(null)
    setDirty(false)

    const apply = (content: string, updatedAt: string) => {
      editor.commands.setContent(content, { contentType: 'markdown' })
      const page = convertPageLinks(editor.getJSON())
      const wiki = convertWikiLinks(page.doc)
      if (page.changed || wiki.changed) editor.commands.setContent(wiki.doc)
      baseRef.current = { content: editor.getMarkdown(), updatedAt }
      loadingRef.current = false
      setStatus('ready')
    }

    fetchNote(path, { refresh: true })
      .then((n) => {
        if (cancelled) return
        if (!n) {
          loadingRef.current = false
          setStatus('missing')
          return
        }
        apply(n.content ?? '', n.updatedAt)
      })
      .catch((e) => {
        if (cancelled) return
        // A cached copy is still editable when the refresh fails.
        const cached = getState().notes[path]
        if (cached?.content !== undefined) {
          apply(cached.content, cached.updatedAt)
          setLoadError(e instanceof Error ? e.message : String(e))
        } else {
          loadingRef.current = false
          setStatus('error')
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // ——— leave-guard: flush a pending save before navigating away ———
  useEffect(() => {
    if (!dirty && !isSaving) {
      setRouteGuard(null)
      return
    }
    setRouteGuard(() => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      void flushRef.current()
      return true
    })
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      setRouteGuard(null)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [dirty, isSaving])

  // ——— teardown: stop the timer + any live mic stream ———
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      const r = recRef.current
      if (r) {
        try {
          if (r.recorder.state !== 'inactive') r.recorder.stop()
        } catch {
          /* already stopped */
        }
        r.stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // ——— voice ———
  const finishVoice = async (chunks: Blob[]) => {
    recRef.current = null
    setRec('transcribing')
    const s = getSettings()
    try {
      const blob = new Blob(chunks, { type: 'audio/webm' })
      const text = await transcribe({
        blob,
        baseUrl: s.scribeUrl,
        model: s.scribeModel,
        token: s.scribeToken || undefined,
        cleanup: s.scribeCleanup,
      })
      editor?.chain().focus().insertContent(text).run()
    } catch (e) {
      toast('error', `Transcription failed — ${e instanceof Error ? e.message : e}`)
    } finally {
      setRec('idle')
    }
  }

  const startVoice = async () => {
    if (recRef.current) {
      // Second click — stop and transcribe.
      try {
        if (recRef.current.recorder.state !== 'inactive') recRef.current.recorder.stop()
      } catch {
        /* already stopped */
      }
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      toast('error', `Microphone unavailable — ${e instanceof Error ? e.message : e}`)
      return
    }
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      void finishVoice(chunks)
    }
    recRef.current = { recorder, stream }
    recorder.start()
    setRec('recording')
  }
  voiceStartRef.current = startVoice

  // ——— image upload (drop / paste / picker) ———
  const uploadAndInsert = async (file: File, at?: number) => {
    if (!editor) return
    if (!file.type.startsWith('image/')) {
      toast('error', `${file.name} isn’t an image`)
      return
    }
    toast('info', `Uploading ${file.name}…`)
    try {
      const { path: assetPath, mimeType } = await uploadImage(file)
      const src = `/api/storage/${assetPath}`
      const node = { type: 'image', attrs: { src, alt: file.name } }
      if (typeof at === 'number') {
        editor.chain().insertContentAt(at, node).run()
      } else {
        editor.chain().focus().insertContent(node).run()
      }
      // Best-effort: also record it as a note attachment so it appears in the
      // note's Attachments in the Parachute app. Never blocks the inline embed.
      void linkNoteAttachment(path, assetPath, mimeType).catch(() => {})
      toast('success', `${file.name} added`)
    } catch (e) {
      toast('error', `Upload failed — ${e instanceof Error ? e.message : e}`)
    }
  }
  uploadImageRef.current = (file, at) => void uploadAndInsert(file, at)

  // ——— sub-page insertion ———
  const insertSubPage = (pagePath: string) => {
    if (editor && subPageAt != null) {
      editor
        .chain()
        .focus()
        .insertContentAt(subPageAt, { type: 'subPageLink', attrs: { path: pagePath } })
        .run()
    }
    setSubPageAt(null)
  }

  // ——— conflict resolution ———
  const loadTheirs = () => {
    if (!conflict || !editor) return
    loadingRef.current = true
    editor.commands.setContent(conflict.content ?? '', { contentType: 'markdown' })
    const page = convertPageLinks(editor.getJSON())
    const wiki = convertWikiLinks(page.doc)
    if (page.changed || wiki.changed) editor.commands.setContent(wiki.doc)
    baseRef.current = { content: editor.getMarkdown(), updatedAt: conflict.updatedAt }
    loadingRef.current = false
    setConflict(null)
    setDirty(false)
    toast('info', 'Loaded the live version into the editor')
  }

  const overwriteMine = async () => {
    if (!conflict || !editor) return
    const md = editor.getMarkdown()
    try {
      const updated = await forceContent(path, md, conflict.updatedAt)
      baseRef.current = { content: updated.content ?? md, updatedAt: updated.updatedAt }
      setConflict(null)
      setDirty(false)
      toast('success', 'Saved — your version is now live')
    } catch (e) {
      toast('error', `Couldn’t save — ${e instanceof Error ? e.message : e}`)
      try {
        const fresh = await fetchNote(path, { refresh: true })
        if (fresh) setConflict(fresh)
      } catch {
        /* keep the stale conflict bar */
      }
    }
  }

  const doDelete = async () => {
    setConfirmDelete(false)
    try {
      // Don't let the leave-guard try to save a note we're deleting.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      setDirty(false)
      await deletePage(path)
      setRouteGuard(null)
      toast('success', 'Page deleted')
      navigate({ kind: 'pages' })
    } catch (e) {
      toast('error', `Couldn’t delete — ${e instanceof Error ? e.message : e}`)
    }
  }

  if (status === 'missing') {
    return (
      <div className="page-editor">
        <div className="page-empty">
          <p className="page-empty-title">Page not found</p>
          <p className="page-empty-msg">
            <code>{path}</code> isn’t in the vault{loadError ? ` — ${loadError}` : '.'}
          </p>
          <a className="btn btn-ghost" href="#/pages">
            Back to pages
          </a>
        </div>
      </div>
    )
  }

  const saveLabel = isSaving
    ? 'Saving…'
    : dirty
      ? 'Unsaved'
      : baseRef.current
        ? `Saved · ${relativeTime(baseRef.current.updatedAt)}`
        : ''

  return (
    <div className="page-editor">
      <div className="page-topbar">
        <span
          className={`page-save${dirty || isSaving ? ' is-active' : ''}`}
          data-testid="page-save"
        >
          {saveLabel}
        </span>
        <div className="page-tools">
          <button
            className={`page-tool${rec === 'recording' ? ' is-recording' : ''}`}
            title={
              rec === 'recording'
                ? 'Stop recording'
                : rec === 'transcribing'
                  ? 'Transcribing…'
                  : 'Dictate (voice → text)'
            }
            aria-label="Voice"
            disabled={rec === 'transcribing' || !editor}
            onClick={() => void startVoice()}
          >
            <IconMic size={15} />
          </button>
          <button
            className="page-tool page-tool-danger"
            title="Delete page"
            aria-label="Delete page"
            onClick={() => setConfirmDelete(true)}
          >
            <IconTrash size={15} />
          </button>
        </div>
      </div>

      {note && (note.tags?.length || path) && (
        <div className="page-meta" data-testid="page-meta">
          <span className="page-meta-path" title={path}>{path}</span>
          {note.tags?.length ? (
            <span className="page-meta-tags">
              {note.tags.map((t) => (
                <a
                  key={t}
                  className="page-meta-tag"
                  href={`#/library`}
                  title={`Filter Library by #${t}`}
                >
                  #{t}
                </a>
              ))}
            </span>
          ) : null}
        </div>
      )}

      {note && databaseForPath(path) && (
        <RecordProperties note={note} def={databaseForPath(path)!} />
      )}

      {rec !== 'idle' && (
        <div className={`voice-bar voice-${rec}`} role="status">
          <span className="voice-dot" />
          {rec === 'recording' ? 'Listening… click the mic to stop' : 'Transcribing…'}
        </div>
      )}

      {conflict && (
        <div className="conflict-bar" role="alert">
          <div className="conflict-text">
            <strong>This page changed in the vault while you were editing.</strong>
            <span>Live version — choose what survives.</span>
          </div>
          <div className="conflict-actions">
            <button className="btn btn-ghost" onClick={loadTheirs}>
              Load theirs
            </button>
            <button className="btn btn-danger" onClick={() => void overwriteMine()}>
              Overwrite with mine
            </button>
          </div>
        </div>
      )}

      <div className={`page-canvas${status === 'loading' ? ' is-loading' : ''}`}>
        {editor && (
          <DragHandle editor={editor}>
            <div className="drag-grip" aria-hidden="true">
              <span />
              <span />
            </div>
          </DragHandle>
        )}
        <EditorContent editor={editor} className="page-content" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          const at = pendingImageAt.current ?? undefined
          pendingImageAt.current = null
          for (const f of files) uploadImageRef.current(f, at)
          e.target.value = ''
        }}
      />

      {subPageAt != null && (
        <SubPagePicker
          onClose={() => setSubPageAt(null)}
          onPick={insertSubPage}
          excludePath={path}
        />
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} width={420} labelledBy="del-title">
          <div className="canon-confirm">
            <IconTrash size={22} className="canon-confirm-icon" />
            <h2 id="del-title">Delete this page?</h2>
            <p>
              <code>{path}</code> will be removed from the vault. This can’t be undone
              from here.
            </p>
            <div className="canon-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => void doDelete()}>
                Delete page
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ——— sub-page picker: link an existing page or create a new one ———

function SubPagePicker({
  onClose,
  onPick,
  excludePath,
}: {
  onClose: () => void
  onPick: (path: string) => void
  excludePath: string
}) {
  const { pages, notes } = useStore()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const all = (pages ?? []).filter((p) => p !== excludePath)
  const q = query.trim().toLowerCase()
  const matches = q
    ? all.filter((p) => titleFromPath(p).toLowerCase().includes(q) || p.toLowerCase().includes(q))
    : all

  const create = async () => {
    const title = query.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      const note = await createPage({ title })
      onPick(note.path)
    } catch (e) {
      toast('error', `Couldn’t create page — ${e instanceof Error ? e.message : e}`)
      setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} width={460} labelledBy="subpage-title">
      <div className="subpage-picker">
        <h2 id="subpage-title" className="subpage-picker-title">
          Link a page
        </h2>
        <input
          autoFocus
          className="subpage-search"
          placeholder="Search pages, or type a new title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches.length === 0 && query.trim()) {
              e.preventDefault()
              void create()
            }
          }}
        />
        <div className="subpage-list">
          {matches.map((p) => {
            const note = notes[p]
            return (
              <button key={p} className="subpage-row" onClick={() => onPick(p)}>
                <IconPage size={14} />
                <span className="subpage-row-title">{titleFromPath(p)}</span>
                <span className="subpage-row-meta">
                  {note ? relativeTime(note.updatedAt) : ''}
                </span>
              </button>
            )
          })}
          {query.trim() && (
            <button className="subpage-row subpage-create" disabled={busy} onClick={() => void create()}>
              <IconPlus size={14} />
              <span className="subpage-row-title">
                Create “{query.trim()}”
              </span>
            </button>
          )}
          {!query.trim() && matches.length === 0 && (
            <p className="subpage-empty">No pages yet — type a title to create one.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
