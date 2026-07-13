// The page canvas. A Tiptap editor whose storage is ALWAYS markdown, so page
// notes stay interoperable with Library search, Graph, and NotePage. Mirrors
// NotePage's write discipline — a baseRef of { content, updatedAt }, optimistic
// concurrency via saveContent, the conflict bar, setRouteGuard + beforeunload —
// but the editing surface is blocks (slash menu, drag handles, /ai, /voice).

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Color } from '@tiptap/extension-text-style'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import type { Note } from '../lib/types'
import {
  ContentDivergedError,
  createPage,
  deletePage,
  fetchLinkTargets,
  fetchNote,
  fetchNoteLinks,
  forceContent,
  getState,
  linkNoteAttachment,
  movePage,
  renameUntitledPage,
  rewriteLinksIn,
  saveContent,
  setCurrentNote,
  toast,
  uploadImage,
  useStore,
  type LinkedNote,
} from '../lib/store'
import { navigate, setRouteGuard } from '../lib/router'
import { CSV_IMPORT_EVENT, PAGE_EXTERNAL_UPDATE_EVENT } from '../lib/ui'
import { parseDelimited, rowsToTableJSON } from '../lib/csv'
import { relativeTime, titleFromPath } from '../lib/format'
import { fuzzyScore } from '../lib/fuzzy'
import { databaseForPath } from '../domain/databases'
import { RecordProperties } from '../components/RecordProperties'
import { getSettings } from '../lib/editorSettings'
import { transcribe } from '../lib/scribe'
import { Modal } from '../components/Modal'
import { IconLink, IconMic, IconPage, IconPlus, IconTrash } from '../components/Icons'
import { SubPageLink, convertPageLinks } from '../editor/extensions/SubPageLink'
import { WikiLink, convertWikiLinks } from '../editor/extensions/WikiLink'
import { WikiLinkSuggest } from '../editor/extensions/WikiLinkSuggest'
import { MarkdownLiteral } from '../editor/extensions/markdownLiteral'
import { VaultImage } from '../editor/extensions/VaultImage'
import { AiBlock } from '../editor/extensions/AiBlock'
import { SlashCommand } from '../editor/extensions/SlashCommand'
import { BoardEmbed, convertBoardEmbeds } from '../editor/extensions/BoardEmbed'
import { Kanban } from '../editor/extensions/Kanban'
import { ColorText } from '../editor/extensions/ColorText'
import { MarkSpanParser, RichHighlight } from '../editor/extensions/RichHighlight'
import {
  ToggleContent,
  ToggleDetails,
  ToggleSize,
  ToggleSummary,
} from '../editor/extensions/ToggleDetails'
import { FormatBar } from '../components/FormatBar'
import { TableBar } from '../components/TableBar'

type Status = 'loading' | 'ready' | 'missing' | 'error'
type Rec = 'idle' | 'recording' | 'transcribing'

const SAVE_DEBOUNCE = 900

export function PageEditor({ path, inPeek = false }: { path: string; inPeek?: boolean }) {
  const { saving, notes } = useStore()
  const note = notes[path]
  const [status, setStatus] = useState<Status>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<Note | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [subPageAt, setSubPageAt] = useState<number | null>(null)
  const [linkPicker, setLinkPicker] = useState(false)
  // F1b — click-to-edit path. `pathDraft` is the in-progress edit; `moveGuard`
  // holds the confirm state when the note has inbound [[links]] that would break.
  const [pathDraft, setPathDraft] = useState<string | null>(null)
  const [moveGuard, setMoveGuard] = useState<{ newPath: string; incoming: LinkedNote[] } | null>(null)
  const [moving, setMoving] = useState(false)
  const [rec, setRec] = useState<Rec>('idle')
  const [dirty, setDirty] = useState(false)
  // /table-from-csv modal (opened by the slash menu via CSV_IMPORT_EVENT).
  const [csvOpen, setCsvOpen] = useState(false)
  const [csvText, setCsvText] = useState('')

  const baseRef = useRef<{ content: string; updatedAt: string } | null>(null)
  const editorRootRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(true)
  const saveTimer = useRef<number | null>(null)
  const onUpdateRef = useRef<() => void>(() => {})
  const flushRef = useRef<() => void>(() => {})
  const recRef = useRef<{ recorder: MediaRecorder; stream: MediaStream } | null>(null)
  const voiceStartRef = useRef<() => void>(() => {})
  // Image upload: handleDrop/handlePaste and the /image picker all funnel here.
  const uploadImageRef = useRef<(file: File, at?: number) => void>(() => {})
  // CSV/TSV paste → table. A ref because editorProps closes over the
  // first-render `editor` (null), same trick as uploadImageRef.
  const csvPasteRef = useRef<(event: ClipboardEvent) => boolean>(() => false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImageAt = useRef<number | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      // E1 — highlight: plain amber round-trips as ==…==; colored highlights
      // (the format-bar swatches) as <mark style>. ⌘⇧H / ==typing== still work.
      RichHighlight,
      MarkSpanParser,
      // #20 — colored text: ColorText carries the custom <span style> markdown
      // round-trip; Color supplies the setColor/unsetColor commands.
      ColorText,
      Color,
      // #18 — toggles: <details>/<summary> blocks, /toggle to insert.
      // persist:true → the open state lives in the doc, so inserting with
      // open:true actually opens (it is NOT serialized — renderMarkdown
      // only writes data-size).
      ToggleDetails.configure({ persist: true }),
      ToggleSummary,
      ToggleContent,
      ToggleSize,
      // Tables — GFM pipe tables, first-party markdown round-trip (Adam's
      // "renders perfectly in markdown" law). /table inserts 3×3.
      TableKit.configure({ table: { resizable: false } }),
      // T6 — ![[board:key]] renders the live project board inside the page.
      BoardEmbed,
      // PR3 — /kanban: a standalone in-page board, stored as <!--kanban--> +
      // a GFM pipe table (renders as a plain table everywhere else).
      Kanban,
      VaultImage, // resolves /api/storage vault paths (auth-safe); no base64
      Markdown,
      MarkdownLiteral,
      SubPageLink,
      WikiLink,
      WikiLinkSuggest,
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
        if (files.length === 0) return csvPasteRef.current(event)
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
      // F1a — auto-slug: an untitled placeholder follows its first real title
      // (pages/untitled-N → pages/<slug>). Safe: new pages have no inbound
      // links yet. On success, swap the route to the new path.
      const h1 = md.match(/^\s{0,3}#{1,6}[ \t]+(.+?)[ \t]*$/m)?.[1]
      if (h1 && /^pages\/untitled(-\d+)?$/.test(path)) {
        const renamed = await renameUntitledPage(path, h1, updated.updatedAt)
        if (renamed) navigate({ kind: 'pages', path: renamed.path })
      }
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
      const wiki = convertWikiLinks(convertBoardEmbeds(page.doc).doc)
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

    // Ask AI's "Insert into page" (or any external writer) announces its save;
    // re-sync the editor in place — but never clobber live unsaved edits (a
    // dirty editor keeps its buffer; the external text is already in the vault
    // and the normal conflict flow reconciles on the next save).
    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { path?: string; content?: string; updatedAt?: string }
        | undefined
      if (!detail || detail.path !== path || cancelled) return
      if (loadingRef.current || !baseRef.current || !editor) return
      const clean = editor.getMarkdown() === baseRef.current.content
      if (!clean) return
      apply(detail.content ?? '', detail.updatedAt ?? '')
    }
    window.addEventListener(PAGE_EXTERNAL_UPDATE_EVENT, onExternal)

    return () => {
      cancelled = true
      window.removeEventListener(PAGE_EXTERNAL_UPDATE_EVENT, onExternal)
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

  // ——— CSV/TSV → table (paste + /table-from-csv modal) ———
  // Paste path: convert ONLY when the text is confidently tabular — false
  // positives are worse than misses, so anything ambiguous falls through to
  // the default paste.
  csvPasteRef.current = (event) => {
    if (!editor || editor.isActive('table')) return false
    const cb = event.clipboardData
    if (!cb) return false
    // HTML tables (Sheets/Notion rich copies) are ProseMirror's job.
    if (cb.getData('text/html').toLowerCase().includes('<table')) return false
    const text = cb.getData('text/plain')
    if (!text) return false
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    if (lines.filter((l) => l.trim() !== '').length < 2) return false
    const rows = parseDelimited(text)
    if (!rows) return false
    event.preventDefault()
    editor.chain().focus().insertContent(rowsToTableJSON(rows)).run()
    return true
  }

  useEffect(() => {
    // Only the focused editor claims the event (a peeked page and the main
    // page can both be mounted).
    const onCsvImport = () => {
      if (!editor?.isFocused) return
      setCsvText('')
      setCsvOpen(true)
    }
    window.addEventListener(CSV_IMPORT_EVENT, onCsvImport)
    return () => window.removeEventListener(CSV_IMPORT_EVENT, onCsvImport)
  }, [editor])

  // The modal relaxes to ≥1 column — the user explicitly asked for a table.
  const csvRows = csvOpen ? parseDelimited(csvText, 1) : null
  const createCsvTable = () => {
    if (!csvRows || !editor) return
    editor.chain().focus().insertContent(rowsToTableJSON(csvRows)).run()
    setCsvOpen(false)
    setCsvText('')
    toast('success', `Table created — ${csvRows.length} row${csvRows.length === 1 ? '' : 's'}`)
  }

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
    const wiki = convertWikiLinks(convertBoardEmbeds(page.doc).doc)
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

  // ——— #9 browse-to-link: insert a wikilink chip at the cursor ———
  const insertWikiLink = (target: string) => {
    setLinkPicker(false)
    editor
      ?.chain()
      .focus()
      .insertContent([
        { type: 'wikiLink', attrs: { target } },
        { type: 'text', text: ' ' },
      ])
      .run()
  }

  // ——— F1b: move / re-file, guarded by inbound [[links]] ———
  const submitPathEdit = async () => {
    const raw = (pathDraft ?? '').trim().replace(/^\/+|\/+$/g, '')
    setPathDraft(null)
    if (!raw || raw === path || moving) return
    setMoving(true)
    try {
      // Don't move out from under an unsaved body.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      await flushSave()
      const { incoming } = await fetchNoteLinks(path)
      if (incoming.length > 0) {
        setMoveGuard({ newPath: raw, incoming })
        return
      }
      await doMove(raw, [])
    } catch (e) {
      toast('error', `Couldn’t check links — ${e instanceof Error ? e.message : e}`)
    } finally {
      setMoving(false)
    }
  }

  const doMove = async (newPath: string, rewrite: LinkedNote[]) => {
    setMoveGuard(null)
    setMoving(true)
    try {
      const ifUpdatedAt = baseRef.current?.updatedAt ?? note?.updatedAt
      if (!ifUpdatedAt) throw new Error('note not loaded yet')
      const moved = await movePage(path, newPath, ifUpdatedAt)
      let fixed = 0
      for (const l of rewrite) {
        try {
          if (await rewriteLinksIn(l.path, path, newPath)) fixed++
        } catch {
          // best-effort per linker; the audit pass catches stragglers
        }
      }
      setRouteGuard(null)
      setDirty(false)
      toast(
        'success',
        rewrite.length
          ? `Moved · updated ${fixed} of ${rewrite.length} linking note${rewrite.length === 1 ? '' : 's'}`
          : `Moved to ${moved.path}`,
      )
      navigate({ kind: 'pages', path: moved.path })
    } catch (e) {
      toast('error', `Couldn’t move — ${e instanceof Error ? e.message : e}`)
    } finally {
      setMoving(false)
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
    <div className={`page-editor${inPeek ? ' in-peek' : ''}`} ref={editorRootRef}>
      {!inPeek && (
      <div className="page-topbar">
        {path.startsWith('tasks/') && !inPeek && (
          <button
            className="page-back-tracker"
            data-testid="back-to-tracker"
            title="Back to the Tracker"
            onClick={() => navigate({ kind: 'tracker' })}
          >
            ← Tracker
          </button>
        )}
        {!inPeek &&
          (path.startsWith('canvas/') || note?.tags?.includes('canvas')) && (
            <button
              className="page-back-tracker"
              data-testid="back-to-canvas"
              title="Back to the canvas you were on"
              onClick={() => navigate({ kind: 'canvas' })}
            >
              ← Canvas
            </button>
          )}
        <span
          className={`page-save${dirty || isSaving ? ' is-active' : ''}`}
          data-testid="page-save"
        >
          {saveLabel}
        </span>
        <div className="page-tools">
          <button
            className="page-tool"
            title="Insert a link to any note ([[ also works while typing)"
            aria-label="Insert link"
            data-testid="insert-link"
            onClick={() => setLinkPicker(true)}
          >
            <IconLink size={15} />
          </button>
          <button
            className="page-tool"
            title="Set as current — what I'm working on right now"
            aria-label="Set as current"
            data-testid="set-current"
            onClick={() => void setCurrentNote(path)}
          >
            📍
          </button>
          <button
            className="page-tool"
            title="Fullscreen (Esc to exit)"
            aria-label="Fullscreen"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen()
              else void editorRootRef.current?.requestFullscreen()
            }}
          >
            ⛶
          </button>
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
      )}

      {!inPeek && note && (note.tags?.length || path) && (
        <div className="page-meta" data-testid="page-meta">
          {pathDraft === null ? (
            <button
              className="page-meta-path page-meta-path-btn"
              title="Click to edit the path — re-file this note anywhere"
              data-testid="path-edit"
              disabled={moving}
              onClick={() => setPathDraft(path)}
            >
              {path}
            </button>
          ) : (
            <input
              autoFocus
              className="page-meta-path-input"
              data-testid="path-input"
              value={pathDraft}
              onChange={(e) => setPathDraft(e.target.value)}
              onBlur={() => setPathDraft(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitPathEdit()
                if (e.key === 'Escape') setPathDraft(null)
              }}
            />
          )}
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

      {!inPeek && note && databaseForPath(path) && (
        <RecordProperties note={note} def={databaseForPath(path)!} />
      )}

      {editor && <TableBar editor={editor} />}

      {editor && <FormatBar editor={editor} />}

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

      {linkPicker && (
        <LinkPicker
          onClose={() => setLinkPicker(false)}
          onPick={insertWikiLink}
          excludePath={path}
        />
      )}

      {moveGuard && (
        <Modal onClose={() => setMoveGuard(null)} width={500} labelledBy="move-title">
          <div className="canon-confirm">
            <h2 id="move-title">
              {moveGuard.incoming.length} note{moveGuard.incoming.length === 1 ? '' : 's'} link
              here
            </h2>
            <p>
              Moving <code>{path}</code> → <code>{moveGuard.newPath}</code> would break their{' '}
              <code>[[links]]</code>. I can rewrite them to the new path in the same move.
            </p>
            <ul className="move-linkers">
              {moveGuard.incoming.slice(0, 8).map((l) => (
                <li key={l.path}>
                  <code>{l.path}</code>
                </li>
              ))}
              {moveGuard.incoming.length > 8 && (
                <li>…and {moveGuard.incoming.length - 8} more</li>
              )}
            </ul>
            <div className="canon-actions">
              <button className="btn btn-ghost" onClick={() => setMoveGuard(null)}>
                Cancel
              </button>
              <button
                className="btn btn-ghost"
                disabled={moving}
                onClick={() => void doMove(moveGuard.newPath, [])}
              >
                Move only
              </button>
              <button
                className="btn btn-gold"
                data-testid="move-and-fix"
                disabled={moving}
                onClick={() => void doMove(moveGuard.newPath, moveGuard.incoming)}
              >
                Move + update links
              </button>
            </div>
          </div>
        </Modal>
      )}

      {csvOpen && (
        <Modal onClose={() => setCsvOpen(false)} width={520} labelledBy="csv-title">
          <div className="subpage-picker" data-testid="csv-import">
            <h2 id="csv-title" className="subpage-picker-title">
              Table from CSV
            </h2>
            <textarea
              autoFocus
              className="subpage-search"
              data-testid="csv-input"
              rows={8}
              placeholder="Paste CSV or TSV…"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
            <div className="canon-actions">
              <button className="btn btn-ghost" onClick={() => setCsvOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-gold"
                data-testid="csv-create"
                disabled={!csvRows}
                onClick={createCsvTable}
              >
                Create table
              </button>
            </div>
          </div>
        </Modal>
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

// ——— #9 link picker: browse/search the WHOLE vault, insert a [[wikilink]] ———

function LinkPicker({
  onClose,
  onPick,
  excludePath,
}: {
  onClose: () => void
  onPick: (path: string) => void
  excludePath: string
}) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<Note[] | null>(null)

  useEffect(() => {
    void fetchLinkTargets()
      .then(setAll)
      .catch(() => setAll([]))
  }, [])

  const q = query.trim()
  const list = all ?? []
  const matches = (
    q
      ? list
          .map((n) => {
            const title = titleFromPath(n.path)
            const s = Math.max(
              fuzzyScore(q, title) ?? -Infinity,
              (fuzzyScore(q, n.path) ?? -Infinity) - 1,
            )
            return { n, s }
          })
          .filter((x) => x.s !== -Infinity)
          .sort((a, b) => b.s - a.s)
          .map((x) => x.n)
      : [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  )
    .filter((n) => n.path !== excludePath)
    .slice(0, 24)

  return (
    <Modal onClose={onClose} width={460} labelledBy="linkpicker-title">
      <div className="subpage-picker" data-testid="link-picker">
        <h2 id="linkpicker-title" className="subpage-picker-title">
          Link a note
        </h2>
        <input
          autoFocus
          className="subpage-search"
          placeholder="Search every note in the vault…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) {
              e.preventDefault()
              onPick(matches[0].path)
            }
          }}
        />
        <div className="subpage-list">
          {all === null ? (
            <p className="subpage-empty">Loading the vault…</p>
          ) : matches.length === 0 ? (
            q ? (
              <button className="subpage-row subpage-create" onClick={() => onPick(q)}>
                <IconPlus size={14} />
                <span className="subpage-row-title">Link “{q}” as typed</span>
              </button>
            ) : (
              <p className="subpage-empty">No notes yet.</p>
            )
          ) : (
            matches.map((n) => (
              <button key={n.path} className="subpage-row" onClick={() => onPick(n.path)}>
                <IconPage size={14} />
                <span className="subpage-row-title">{titleFromPath(n.path)}</span>
                <span className="subpage-row-meta">{n.path}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
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
