import { Activity, ArrowRight, BellRing, Bot, CheckCircle2, ChevronRight, CircleAlert, Clock3, FileHeart, Info, LineChart, ShieldCheck, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHealthSignals, type MetricTrend, type TrendWindow } from '../context/HealthSignalsContext'
import { openCopilotDrawer } from '../lib/copilot-drawer'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function Sparkline({ trend }: { trend: MetricTrend }) {
  const values = trend.values.map((point) => point.value)
  if (values.length < 2) return <div className="signal-sparkline-empty">More check-ins needed</div>
  const width = 160
  const height = 50
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : index * (width / (values.length - 1))
    const y = height - ((value - 1) / 9) * height
    return `${x},${y}`
  }).join(' ')
  return <svg className="signal-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${trend.label} trend`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

function directionCopy(trend: MetricTrend) {
  if (trend.direction === 'insufficient') return 'Not enough data'
  if (trend.direction === 'stable') return 'Stable'
  return trend.direction === 'improving' ? 'Improving' : 'Needs attention'
}

export function HealthSignals() {
  const { signals, pendingSignals, confirmedSignals, trends, structuredResponses } = useHealthSignals()
  const [window, setWindow] = useState<TrendWindow>('7d')
  const selectedTrends = trends[window]

  return (
    <div className="page signals-page">
      <section className="page-heading split-heading">
        <div>
          <div className="eyebrow">Patient-reviewed pattern detection</div>
          <h1>Health signals</h1>
          <p>Vital Passport turns repeated check-ins into explainable trends, then asks you to confirm every signal before it joins your health story.</p>
        </div>
        <div className="signals-window-toggle" aria-label="Trend window">
          <button className={window === '7d' ? 'active' : ''} onClick={() => setWindow('7d')}>7 days</button>
          <button className={window === '30d' ? 'active' : ''} onClick={() => setWindow('30d')}>30 days</button>
        </div>
      </section>

      <section className="signals-hero">
        <span><Activity size={28}/></span>
        <div><div className="eyebrow">Current signal state</div><h2>{pendingSignals.length ? `${pendingSignals.length} ${pendingSignals.length === 1 ? 'pattern needs' : 'patterns need'} your review` : 'No unreviewed patterns'}</h2><p>{structuredResponses.length} structured check-ins are available. Signals describe patterns and timing, never diagnoses or proven causes.</p></div>
        <Link to="/inbox" className="button primary">Review in Health Inbox <ArrowRight size={16}/></Link>
      </section>

      <section className="signals-trend-section">
        <div className="section-mini-heading"><LineChart size={18}/><strong>{window === '7d' ? 'Seven-day' : 'Thirty-day'} trends</strong><span>Scores are patient reported on a 1–10 scale.</span></div>
        <div className="signals-trend-grid">
          {selectedTrends.map((trend) => {
            const DirectionIcon = trend.direction === 'improving' ? TrendingUp : trend.direction === 'worsening' ? TrendingDown : Activity
            return <article className={`signal-trend-card ${trend.direction}`} key={trend.key}>
              <div className="signal-trend-top"><div><span>{trend.label}</span><strong>{trend.current ?? '–'}<small>/10</small></strong></div><div className="signal-direction"><DirectionIcon size={15}/>{directionCopy(trend)}</div></div>
              <Sparkline trend={trend}/>
              <div className="signal-trend-footer"><span>{trend.values.length} check-ins</span><b>{trend.previous === null ? 'Baseline forming' : `${trend.delta > 0 ? '+' : ''}${trend.delta} vs prior period`}</b></div>
            </article>
          })}
        </div>
      </section>

      <div className="signals-layout">
        <section className="signals-stack">
          <div className="section-mini-heading"><Sparkles size={18}/><strong>Detected patterns</strong><span>Deterministic rules with visible evidence.</span></div>
          {signals.length ? signals.map((signal) => (
            <article className={`health-signal-card ${signal.severity} ${signal.status}`} key={signal.id}>
              <div className="health-signal-icon">{signal.status === 'confirmed' || signal.status === 'edited' ? <CheckCircle2 size={20}/> : signal.severity === 'attention' ? <CircleAlert size={20}/> : <Info size={20}/>}</div>
              <div className="health-signal-body">
                <div className="health-signal-heading"><div><span>{signal.severity === 'attention' ? 'Attention signal' : 'Watch signal'}</span><h3>{signal.title}</h3></div><em>{signal.status === 'pending' || signal.status === 'not_queued' ? 'Needs review' : signal.status}</em></div>
                <p>{signal.detail}</p>
                <details><summary>Why Vital Passport noticed this <ChevronRight size={14}/></summary><ul>{signal.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></details>
                <div className="health-signal-actions">
                  <Link to="/inbox">Review signal <ChevronRight size={14}/></Link>
                  <button onClick={() => openCopilotDrawer(`Explain this health signal conservatively: ${signal.title}. Use the check-in evidence, preserve uncertainty, and do not claim causation.`)}><Bot size={14}/> Ask Copilot</button>
                  <Link to="/prepare"><BellRing size={14}/> Add to visit prep</Link>
                  {(signal.status === 'confirmed' || signal.status === 'edited') && <Link to="/brief"><FileHeart size={14}/> View in brief</Link>}
                </div>
              </div>
            </article>
          )) : <div className="signals-empty"><Activity size={24}/><strong>No signals yet</strong><span>Complete a few structured check-ins to begin detecting patterns.</span></div>}
        </section>

        <aside className="signals-recent-panel">
          <div className="section-mini-heading"><Clock3 size={18}/><strong>Recent check-ins</strong><span>Latest structured observations.</span></div>
          <div className="signals-summary-stats"><div><strong>{structuredResponses.length}</strong><span>responses</span></div><div><strong>{confirmedSignals.length}</strong><span>confirmed signals</span></div><div><strong>{pendingSignals.length}</strong><span>pending</span></div></div>
          <div className="signals-response-list">
            {structuredResponses.slice(0, 8).map((response) => <div key={response.id}><span><strong>{formatDate(response.createdAt)}</strong>{response.demo && <em>Demo</em>}</span><p>{response.response || 'Scores recorded without an additional note.'}</p><small>Mood {response.metrics.mood} · Sleep {response.metrics.sleep} · Stress {response.metrics.stress} · Symptoms {response.metrics.symptomSeverity}</small></div>)}
          </div>
          <Link to="/check-ins" className="button light signals-checkin-link">Complete another check-in <ArrowRight size={16}/></Link>
          <div className="signals-safety-note"><ShieldCheck size={16}/><span>Signals are generated locally from recorded scores. They do not continuously monitor the patient, diagnose conditions, or establish why a change happened.</span></div>
        </aside>
      </div>
    </div>
  )
}
