import { AlertTriangle, ArrowRight, BookOpenCheck, Bot, CalendarClock, CheckCircle2, ChevronRight, CircleHelp, FileSearch, History, LoaderCircle, MessageCircleMore, Send, Sparkles } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useVital } from '../context/VitalContext'
import { patient } from '../data/demo'
import { askHealthCopilot, buildHealthRecordSnapshot, type CopilotResult, type CopilotSignalKind } from '../lib/copilot'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  result?: CopilotResult
}

const suggestions = [
  'What changed in my health record recently?',
  'What should I clarify before my next visit?',
  'Summarize my medications and any conflicts.',
  'What does my record show about the dizziness timeline?',
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

export function Copilot() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedPrompt = searchParams.get('prompt')?.trim() || ''
  const autoAsked = useRef(false)
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

  const record = useMemo(() => buildHealthRecordSnapshot({
    sources,
    timelineEvents,
    medicationSummaries,
    labResults,
    reconciliationIssues,
    careTasks,
    reviewGaps,
  }), [sources, timelineEvents, medicationSummaries, labResults, reconciliationIssues, careTasks, reviewGaps])

  const openConflicts = reconciliationIssues.filter((issue) => issue.status === 'open')
  const openTasks = careTasks.filter((task) => task.status === 'open')
  const unresolvedGaps = reviewGaps.filter((gap) => !gap.resolved)
  const newestEvent = [...timelineEvents].sort((a, b) => b.date.localeCompare(a.date))[0]

  useEffect(() => {
    window.sessionStorage.setItem('vital-copilot-messages', JSON.stringify(messages.slice(-12)))
  }, [messages])

  const ask = async (rawQuestion: string) => {
    const nextQuestion = rawQuestion.trim()
    if (!nextQuestion || loading) return
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: nextQuestion }
    setMessages((current) => [...current, userMessage])
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
    if (requestedPrompt && !autoAsked.current) {
      autoAsked.current = true
      void ask(requestedPrompt)
    }
  }, [requestedPrompt])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void ask(question)
  }

  const openCitation = (sourceId: string) => {
    const source = sources.find((item) => item.id === sourceId)
    if (source) openSource(source)
  }

  return (
    <div className="page copilot-page">
      <section className="page-heading split-heading copilot-heading">
        <div>
          <div className="eyebrow">Patient-controlled health memory</div>
          <h1>Ask your health history.</h1>
          <p>Vital Passport explains what your records say, shows its sources, and helps you decide what to clarify next.</p>
        </div>
        <div className="copilot-grounded-badge"><CheckCircle2 size={17}/><span>Answers cite your record</span></div>
      </section>

      <div className="copilot-layout">
        <section className="copilot-chat-card">
          <div className="copilot-intro">
            <span className="copilot-orb"><Bot size={28}/></span>
            <div>
              <div className="eyebrow">Vital Health Copilot</div>
              <h2>I remember the story across every upload.</h2>
              <p>I can connect the timeline, medications, labs, symptoms, and open questions without replacing your doctor or inventing facts.</p>
            </div>
          </div>

          {messages.length === 0 && (
            <div className="copilot-starter">
              <div className="copilot-starter-copy">
                <Sparkles size={19}/>
                <div><strong>Start with a useful question</strong><span>I will answer from {sources.length} source records and show exactly where each fact came from.</span></div>
              </div>
              <div className="copilot-suggestion-grid">
                {suggestions.map((suggestion) => <button key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}<ChevronRight size={16}/></button>)}
              </div>
            </div>
          )}

          <div className="copilot-thread" aria-live="polite">
            {messages.map((message) => message.role === 'user' ? (
              <div className="copilot-message user" key={message.id}><div>{message.text}</div></div>
            ) : (
              <article className="copilot-answer" key={message.id}>
                <div className="copilot-answer-header">
                  <span><Bot size={18}/></span>
                  <div><small>{message.result?.record_status === 'limited' ? 'Limited by available records' : 'Grounded in your health record'}</small><h3>{message.result?.headline || 'What your record shows'}</h3></div>
                </div>
                <div className="copilot-answer-text">{message.text.split('\n').filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>

                {message.result?.signals.length ? <div className="copilot-signals">
                  {message.result.signals.map((signal, index) => { const Icon = signalIcons[signal.kind]; return <div className={`copilot-signal ${signal.kind}`} key={`${signal.title}-${index}`}><Icon size={17}/><div><strong>{signal.title}</strong><span>{signal.detail}</span></div></div> })}
                </div> : null}

                {message.result?.citations.length ? <div className="copilot-citations">
                  <div className="copilot-section-label"><FileSearch size={15}/> Sources used</div>
                  {message.result.citations.map((citation, index) => <button key={`${citation.source_id}-${index}`} onClick={() => openCitation(citation.source_id)}><span>{index + 1}</span><div><strong>{citation.label}</strong><small>“{citation.quote}”</small></div><ChevronRight size={15}/></button>)}
                </div> : null}

                {message.result?.next_steps.length ? <div className="copilot-next-steps">
                  <div className="copilot-section-label"><ArrowRight size={15}/> Useful next steps</div>
                  <div>{message.result.next_steps.map((step, index) => <button key={`${step.label}-${index}`} onClick={() => navigate(step.route)}><strong>{step.label}</strong><span>{step.detail}</span><ArrowRight size={15}/></button>)}</div>
                </div> : null}

                {message.result?.follow_up_prompts.length ? <div className="copilot-followups">{message.result.follow_up_prompts.map((prompt) => <button key={prompt} onClick={() => void ask(prompt)}>{prompt}</button>)}</div> : null}
              </article>
            ))}
            {loading && <div className="copilot-thinking"><LoaderCircle size={18}/><span>Reading your timeline and source records…</span></div>}
          </div>

          {error && <div className="copilot-error"><AlertTriangle size={17}/><span>{error}</span></div>}

          <form className="copilot-composer" onSubmit={submit}>
            <MessageCircleMore size={20}/>
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask what changed, what conflicts, or what to prepare for…" rows={2} maxLength={1800}/>
            <button type="submit" disabled={!question.trim() || loading} aria-label="Ask Health Copilot"><Send size={19}/></button>
          </form>
          <p className="copilot-boundary">Vital Passport explains your records and helps you prepare. It does not diagnose conditions or tell you to change treatment.</p>
        </section>

        <aside className="copilot-memory-panel">
          <div className="memory-panel-heading"><span><Sparkles size={20}/></span><div><div className="eyebrow">Your living record</div><h2>{patient.firstName}’s health memory</h2></div></div>
          <div className="memory-stats">
            <div><strong>{sources.length}</strong><span>source records</span></div>
            <div><strong>{timelineEvents.length}</strong><span>timeline events</span></div>
            <div><strong>{medicationSummaries.length}</strong><span>medications</span></div>
            <div><strong>{openTasks.length}</strong><span>open actions</span></div>
          </div>

          <div className="memory-status-list">
            <button onClick={() => navigate('/timeline')}><History size={18}/><span><strong>Latest change</strong><small>{newestEvent ? `${newestEvent.displayDate}: ${newestEvent.title}` : 'Add health information to begin your timeline.'}</small></span><ChevronRight size={16}/></button>
            <button onClick={() => navigate('/prepare')} className={openConflicts.length ? 'attention' : ''}><AlertTriangle size={18}/><span><strong>{openConflicts.length} unresolved {openConflicts.length === 1 ? 'conflict' : 'conflicts'}</strong><small>{openConflicts.length ? 'Confirm which source reflects what you are doing now.' : 'Medication sources are reconciled.'}</small></span><ChevronRight size={16}/></button>
            <button onClick={() => navigate('/prepare')} className={unresolvedGaps.length ? 'attention' : ''}><CircleHelp size={18}/><span><strong>{unresolvedGaps.length} missing {unresolvedGaps.length === 1 ? 'detail' : 'details'}</strong><small>{unresolvedGaps.length ? 'Your documents cannot answer these without you.' : 'Patient context is complete for this visit.'}</small></span><ChevronRight size={16}/></button>
            <button onClick={() => navigate('/brief')}><CalendarClock size={18}/><span><strong>Ready to travel</strong><small>Turn this history into a focused brief for any clinician.</small></span><ChevronRight size={16}/></button>
          </div>

          <button className="button primary memory-primary" onClick={() => navigate('/add')}>Add to my health memory <ArrowRight size={17}/></button>
        </aside>
      </div>
    </div>
  )
}
