import { Brain, CheckCircle2, History, Plus, RotateCcw, ShieldCheck, Trash2, Undo2 } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { useCopilotMemory, type CopilotMemoryKind } from '../context/CopilotMemoryContext'

const kindLabels: Record<CopilotMemoryKind, string> = {
  preference: 'Preference',
  goal: 'Goal',
  concern: 'Ongoing concern',
  context: 'Personal context',
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function Memory() {
  const {
    activeMemories,
    forgottenMemories,
    remember,
    updateMemory,
    forgetMemory,
    restoreMemory,
    clearMemory,
    resetMemory,
  } = useCopilotMemory()
  const [kind, setKind] = useState<CopilotMemoryKind>('context')
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.trim()) return
    remember({ kind, title: title.trim() || kindLabels[kind], value, origin: 'patient' })
    setTitle('')
    setValue('')
  }

  return (
    <div className="page memory-page">
      <section className="page-heading split-heading">
        <div>
          <div className="eyebrow">Patient-controlled Copilot context</div>
          <h1>What Health Copilot remembers</h1>
          <p>Keep preferences, goals, concerns, and personal context available across conversations. Medical facts still require source evidence and Health Inbox confirmation.</p>
        </div>
        <div className="memory-heading-badge"><ShieldCheck size={17}/><span>Visible, editable, forgettable</span></div>
      </section>

      <section className="memory-principles">
        <div><CheckCircle2 size={18}/><span><strong>No hidden memory</strong> Everything remembered appears on this page.</span></div>
        <div><ShieldCheck size={18}/><span><strong>Not clinical evidence</strong> Memory guides context but cannot invent or confirm medical facts.</span></div>
        <div><History size={18}/><span><strong>Patient controlled</strong> Edit, forget, restore, or clear any item.</span></div>
      </section>

      <div className="memory-layout">
        <section className="memory-stack">
          <div className="section-mini-heading"><Brain size={18}/><strong>Active memory</strong><span>{activeMemories.length} items available to Copilot</span></div>
          {activeMemories.length ? activeMemories.map((memory) => (
            <article className={`memory-card ${memory.kind}`} key={memory.id}>
              <div className="memory-card-top">
                <select value={memory.kind} onChange={(event) => updateMemory(memory.id, { kind: event.target.value as CopilotMemoryKind })} aria-label="Memory type">
                  {Object.entries(kindLabels).map(([entryKind, label]) => <option key={entryKind} value={entryKind}>{label}</option>)}
                </select>
                <span>{memory.origin === 'copilot' ? 'Saved from Copilot' : memory.origin === 'check_in' ? 'Saved from check-in' : 'Patient confirmed'}</span>
                <button className="icon-button" onClick={() => forgetMemory(memory.id)} aria-label={`Forget ${memory.title}`}><Trash2 size={17}/></button>
              </div>
              <input value={memory.title} onChange={(event) => updateMemory(memory.id, { title: event.target.value })} aria-label="Memory title" />
              <textarea value={memory.value} rows={3} onChange={(event) => updateMemory(memory.id, { value: event.target.value })} aria-label="Memory details" />
              <small>Updated {formatDate(memory.updatedAt)}{memory.sourceId ? ` · Linked source ${memory.sourceId}` : ''}</small>
            </article>
          )) : <div className="memory-empty"><Brain size={22}/><strong>Copilot memory is empty</strong><span>Add only the context you want carried into future conversations.</span></div>}
        </section>

        <aside className="memory-add-panel">
          <div className="section-mini-heading"><Plus size={18}/><strong>Add memory</strong><span>Explicitly choose what should persist.</span></div>
          <form onSubmit={submit}>
            <label><span>Type</span><select value={kind} onChange={(event) => setKind(event.target.value as CopilotMemoryKind)}>{Object.entries(kindLabels).map(([entryKind, label]) => <option key={entryKind} value={entryKind}>{label}</option>)}</select></label>
            <label><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Communication preference" maxLength={120}/></label>
            <label><span>What should Copilot remember?</span><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Use plain language and help me prepare questions before appointments." rows={5} maxLength={1200}/></label>
            <button className="button primary full" type="submit" disabled={!value.trim()}><Brain size={17}/> Remember this</button>
          </form>
          <div className="memory-danger-zone">
            <button className="button ghost" onClick={resetMemory}><RotateCcw size={16}/> Reset demo memory</button>
            <button className="memory-clear-button" onClick={clearMemory}>Clear all memory</button>
          </div>
        </aside>
      </div>

      {forgottenMemories.length > 0 && <section className="card forgotten-memory-card">
        <div className="card-heading"><div><div className="eyebrow">Recovery</div><h2>Recently forgotten</h2></div><span className="soft-icon"><Undo2 size={19}/></span></div>
        <div className="forgotten-memory-list">{forgottenMemories.slice(0,8).map((memory) => <div key={memory.id}><span><strong>{memory.title}</strong><small>{memory.value}</small></span><button onClick={() => restoreMemory(memory.id)}><Undo2 size={14}/> Restore</button></div>)}</div>
      </section>}
    </div>
  )
}
