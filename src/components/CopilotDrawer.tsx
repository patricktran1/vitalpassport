import { AlertTriangle, ArrowRight, BookOpenCheck, Bot, ChevronRight, CircleHelp, ExternalLink, FileSearch, History, LoaderCircle, MessageCircleMore, Send, Sparkles, X } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVital } from '../context/VitalContext'
import { askHealthCopilot, buildHealthRecordSnapshot, type CopilotResult, type CopilotSignalKind } from '../lib/copilot'
import { VoiceInputButton } from './VoiceInputButton'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  result?: CopilotResult
}

type CopilotDrawerProps = {
  open: boolean
  promptRequest: { id: number; prompt: string }
  onClose: () => void
}

const suggestions = [
  'What changed recently?',
  'What should I clarify before my next visit?',
  'Summarize my medications and any conflicts.',
]

const signalIcons: Record<CopilotSignalKind, typeof History> = {
  change: History,
  attention: AlertTriangle,
  gap: CircleHelp,
  context: BookOpenCheck,
}

function readMessages(): ChatMessage[] {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem('vital-copilot-messages') || '[]')
    return Array.isArray(parsed) ? parsed.slice(-12) : []
  } catch {
    return []
  }
}

export function CopilotDrawer({ open, promptRequest, onClose }: CopilotDrawerProps) {
  const navigate = useNavigate()
  const {
    sources,
    timelineEvents,
    medicationSummaries,
    labResults,
    reconciliationIssues,
    careTasks,
    reviewGaps,
    openSource,
  } = useVital()
  const [messages, setMessages] = useState<ChatMessage[]>(readMessages)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const handledPromptId = useRef(0)
  const threadRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const record = useMemo(() => buildHealthRecordSnapshot({
    sources,
    timelineEvents,
    medicationSummaries,
    labResults,
    reconciliationIssues,
    careTasks,
    reviewGaps,
  }), [sources, timelineEvents, medicationSummaries, labResults, reconciliationIssues, careTasks, reviewGaps])

  useEffect(() => {
    window.sessionStorage.setItem('vital-copilot-messages', JSON.stringify(messages.slice(-12)))
  }, [messages])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 180)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
    }, 40)
    return () => window.clearTimeout(timer)
  }, [messages, loading, open])

  const ask = async (rawQuestion: string) => {
    const nextQuestion = rawQuestion.trim()
    if (!nextQuestion || loading) return
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', text: nextQuestion }])
    setQuestion('')
    setError('')
    setLoading(true)
    try {
      const result = await askHealthCopilot(nextQuestion, record)
      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: result.answer,
        result,
      }])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Health Copilot could not answer that question.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !promptRequest.prompt || handledPromptId.current === promptRequest.id) return
    handledPromptId.current = promptRequest.id
    void ask(promptRequest.prompt)
  }, [open, promptRequest.id, promptRequest.prompt])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void ask(question)
  }

  const appendTranscript = (transcript: string) => {
    setQuestion((current) => [current.trim(), transcript].filter(Boolean).join(' '))
    window.setTimeout(() => textareaRef.current?.focus(), 40)
  }

  const goTo = (route: string) => {
    onClose()
    navigate(route)
  }

  const openCitation = (sourceId: string) => {
    const source = sources.find((item) => item.id === sourceId)
    if (!source) return
    onClose()
    window.setTimeout(() => openSource(source), 120)
  }

  if (!open) return null

  return (
    <>
      <button className="copilot-drawer-backdrop" aria-label="Close Health Copilot" onClick={onClose} />
      <aside className="copilot-drawer" role="dialog" aria-modal="true" aria-label="Health Copilot">
        <header className="copilot-drawer-header">
          <div className="copilot-drawer-title">
            <span><Bot size={21}/></span>
            <div><small>Vital Passport</small><strong>Health Copilot</strong></div>
          </div>
          <div className="copilot-drawer-header-actions">
            <button onClick={() => goTo('/copilot')}><ExternalLink size={16}/><span>Full view</span></button>
            <button className="icon-button" onClick={onClose} aria-label="Close Health Copilot"><X size={20}/></button>
          </div>
        </header>

        <section className="copilot-chat-card copilot-chat-card-drawer">
          {messages.length === 0 && (
            <div className="copilot-starter copilot-drawer-starter">
              <div className="copilot-starter-copy">
                <Sparkles size={18}/>
                <div><strong>Ask your living health record</strong><span>I connect {sources.length} sources and show where every answer came from.</span></div>
              </div>
              <div className="copilot-suggestion-grid">
                {suggestions.map((suggestion) => <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}<ChevronRight size={15}/></button>)}
              </div>
            </div>
          )}

          <div className="copilot-thread copilot-drawer-thread" ref={threadRef} aria-live="polite">
            {messages.map((message) => message.role === 'user' ? (
              <div className="copilot-message user" key={message.id}><div>{message.text}</div></div>
            ) : (
              <article className="copilot-answer" key={message.id}>
                <div className="copilot-answer-header">
                  <span><Bot size={17}/></span>
                  <div><small>{message.result?.record_status === 'limited' ? 'Limited by available records' : 'Grounded in your health record'}</small><h3>{message.result?.headline || 'What your record shows'}</h3></div>
                </div>
                <div className="copilot-answer-text">{message.text.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>

                {message.result?.signals.length ? <div className="copilot-signals">
                  {message.result.signals.map((signal, index) => { const Icon = signalIcons[signal.kind]; return <div className={`copilot-signal ${signal.kind}`} key={`${signal.title}-${index}`}><Icon size={16}/><div><strong>{signal.title}</strong><span>{signal.detail}</span></div></div> })}
                </div> : null}

                {message.result?.citations.length ? <div className="copilot-citations">
                  <div className="copilot-section-label"><FileSearch size={14}/> Sources used</div>
                  {message.result.citations.map((citation, index) => <button key={`${citation.source_id}-${index}`} onClick={() => openCitation(citation.source_id)}><span>{index + 1}</span><div><strong>{citation.label}</strong><small>“{citation.quote}”</small></div><ChevronRight size={14}/></button>)}
                </div> : null}

                {message.result?.next_steps.length ? <div className="copilot-next-steps">
                  <div className="copilot-section-label"><ArrowRight size={14}/> Useful next steps</div>
                  <div>{message.result.next_steps.map((step, index) => <button key={`${step.label}-${index}`} onClick={() => goTo(step.route)}><strong>{step.label}</strong><span>{step.detail}</span><ArrowRight size={14}/></button>)}</div>
                </div> : null}

                {message.result?.follow_up_prompts.length ? <div className="copilot-followups">{message.result.follow_up_prompts.map((prompt) => <button key={prompt} onClick={() => void ask(prompt)}>{prompt}</button>)}</div> : null}
              </article>
            ))}
            {loading && <div className="copilot-thinking"><LoaderCircle size={18}/><span>Reading your timeline and sources…</span></div>}
          </div>

          {error && <div className="copilot-error"><AlertTriangle size={17}/><span>{error}</span></div>}

          <form className="copilot-composer copilot-drawer-composer" onSubmit={submit}>
            <MessageCircleMore size={19}/>
            <textarea ref={textareaRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask by typing or speaking…" rows={2} maxLength={1800}/>
            <VoiceInputButton onTranscript={appendTranscript} disabled={loading} />
            <button type="submit" disabled={!question.trim() || loading} aria-label="Ask Health Copilot"><Send size={18}/></button>
          </form>
          <p className="copilot-boundary">Explains your record and preserves uncertainty. It does not diagnose or change treatment.</p>
        </section>
      </aside>
    </>
  )
}
