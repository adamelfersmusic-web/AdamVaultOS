import { useState } from 'react'
import {
  generatePrimerQuestion,
  AnthropicError,
  type QuizQuestion,
} from '../anthropic'
import { useEditorSettings, openPagesSettings } from '../editorSettings'

// <QuizMe /> — Claude invents a fresh multiple-choice question from the whole
// ai-primer, live, and the learner answers it. One API call per question
// (grading is local), on the user's own key. Infinite practice from your own
// course content.

export function QuizMe() {
  const settings = useEditorSettings()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState<QuizQuestion | null>(null)
  const [picked, setPicked] = useState<number | null>(null)

  const generate = async () => {
    if (loading) return
    if (!settings.anthropicKey) {
      setError('Add your Anthropic API key in Settings to generate questions.')
      return
    }
    setLoading(true)
    setError(null)
    setQ(null)
    setPicked(null)
    try {
      setQ(await generatePrimerQuestion(settings.anthropicKey))
    } catch (e) {
      setError(e instanceof AnthropicError || e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const solved = q && picked === q.correct

  return (
    <div className="mdx-quizme" contentEditable={false}>
      <div className="mdx-quizme-head">
        <span>✦ Quiz me</span>
        <span className="mdx-quizme-sub">Claude writes a fresh question from your course</span>
      </div>

      {!q && !loading && (
        <div className="mdx-quizme-start">
          {!settings.anthropicKey && (
            <button className="mdx-ask-key" onClick={() => openPagesSettings()}>
              Set API key
            </button>
          )}
          <button className="mdx-quizme-go" onClick={() => void generate()}>
            Generate a question
          </button>
        </div>
      )}

      {loading && <div className="mdx-quizme-loading" role="status">Writing a question…</div>}
      {error && <div className="mdx-ask-error">{error}</div>}

      {q && (
        <>
          <div className="mdx-quizme-q">{q.question}</div>
          <div className="mdx-quizme-opts">
            {q.options.map((opt, i) => {
              const state =
                picked === null
                  ? ''
                  : i === q.correct
                    ? ' is-correct'
                    : picked === i
                      ? ' is-wrong'
                      : ' is-dim'
              return (
                <button
                  key={i}
                  className={`mdx-quizme-opt${state}`}
                  disabled={picked !== null}
                  onClick={() => setPicked(i)}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {picked !== null && (
            <div className={`mdx-quizme-verdict${solved ? ' is-win' : ''}`} role="status">
              <strong>{solved ? 'Correct.' : 'Not quite.'}</strong>{' '}
              {q.explanation}
              <button className="mdx-quizme-next" onClick={() => void generate()}>
                Another question →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
