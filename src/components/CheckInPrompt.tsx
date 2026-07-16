import { BellRing, Bot, Clock3, HeartPulse, ShieldCheck, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { defaultCheckInMetrics, useCheckIns, type CheckInMetricKey, type CheckInMetrics, type MedicationExperience } from '../context/CheckInContext'
import { openCopilotDrawer } from '../lib/copilot-drawer'
import { VoiceInputButton } from './VoiceInputButton'

const focusLabels = {
  general: 'General wellbeing',
  mental_health: 'Mood and mental health',
  symptoms: 'Symptoms',
  blood_pressure: 'Blood pressure',
  diabetes: 'Diabetes',
  medication: 'Medication experience',
}

const metricRows: Array<{ key: CheckInMetricKey; label: string; hint: string }> = [
  { key: 'mood', label: 'Mood', hint: 'Higher is better' },
  { key: 'energy', label: 'Energy', hint: 'Higher is better' },
  { key: 'sleep', label: 'Sleep quality', hint: 'Higher is better' },
  { key: 'pain', label: 'Pain', hint: 'Higher means more pain' },
  { key: 'stress', label: 'Stress', hint: 'Higher means more stress' },
  { key: 'symptomSeverity', label: 'Symptom severity', hint: 'Higher means more severe' },
]

const medicationOptions: Array<{ value: MedicationExperience; label: string }> = [
  { value: 'not_applicable', label: 'Not tracking medication today' },
  { value: 'better', label: 'Better' },
  { value: 'unchanged', label: 'Unchanged' },
  { value: 'worse', label: 'Worse' },
  { value: 'side_effects', label: 'Possible side effects' },
]

export function CheckInPrompt() {
  const { activeSchedule, completeCheckIn, snoozeActive } = useCheckIns()
  const [response, setResponse] = useState('')
  const [metrics, setMetrics] = useState<CheckInMetrics>({ ...defaultCheckInMetrics })

  useEffect(() => {
    setResponse('')
    setMetrics({ ...defaultCheckInMetrics })
  }, [activeSchedule?.id])

  if (!activeSchedule) return null

  const appendTranscript = (transcript: string) => {
    setResponse((current) => [current.trim(), transcript].filter(Boolean).join(' '))
  }

  const setScore = (key: CheckInMetricKey, value: number) => {
    setMetrics((current) => ({ ...current, [key]: value }))
  }

  const save = (talkWithCopilot: boolean) => {
    completeCheckIn({ response, metrics })
    if (talkWithCopilot) {
      window.setTimeout(() => openCopilotDrawer('Review my latest structured health check-in. Explain any trend signals conservatively, preserve uncertainty, and ask one gentle follow-up question at a time.'), 120)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save(false)
  }

  return (
    <div className="checkin-prompt-backdrop" role="presentation">
      <section className="checkin-prompt structured" role="dialog" aria-modal="true" aria-labelledby="checkin-prompt-title">
        <header>
          <span className="checkin-prompt-icon"><BellRing size={22}/></span>
          <div><small>Vital Passport check-in</small><strong id="checkin-prompt-title">{activeSchedule.title}</strong></div>
          <button type="button" className="icon-button" onClick={() => snoozeActive(60)} aria-label="Snooze check-in for one hour"><X size={20}/></button>
        </header>

        <div className="checkin-prompt-body">
          <div className="checkin-focus-pill"><HeartPulse size={15}/>{focusLabels[activeSchedule.focus]}</div>
          <h2>{activeSchedule.prompt}</h2>
          <p>Score what you notice, then add an optional note by typing or speaking. Trends remain patient-reported and go through Health Inbox review.</p>

          <form onSubmit={submit}>
            <div className="checkin-score-grid">
              {metricRows.map((metric) => (
                <label className="checkin-score-row" key={metric.key}>
                  <span><strong>{metric.label}</strong><small>{metric.hint}</small></span>
                  <input type="range" min="1" max="10" step="1" value={metrics[metric.key]} onChange={(event) => setScore(metric.key, Number(event.target.value))}/>
                  <b>{metrics[metric.key]}</b>
                </label>
              ))}
            </div>

            <label className="checkin-medication-field">
              <span>Medication experience</span>
              <select value={metrics.medicationExperience} onChange={(event) => setMetrics((current) => ({ ...current, medicationExperience: event.target.value as MedicationExperience }))}>
                {medicationOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>

            <div className="checkin-response-box">
              <textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={4} maxLength={2400} placeholder="Optional: what felt different, when did it happen, or what are you worried about?" />
              <VoiceInputButton onTranscript={appendTranscript} label="Record a voice response" />
            </div>
            <div className="checkin-prompt-actions">
              <button type="button" className="button ghost" onClick={() => snoozeActive(60)}><Clock3 size={16}/> Not now</button>
              <button type="submit" className="button light"><ShieldCheck size={16}/> Save to Health Inbox</button>
              <button type="button" className="button primary" onClick={() => save(true)}><Bot size={16}/> Save and discuss</button>
            </div>
          </form>

          <div className="checkin-safety-note">
            <ShieldCheck size={15}/>
            <span>This is scheduled reflection, not continuous monitoring. A trend does not prove a diagnosis or cause. For immediate danger or a medical emergency, contact local emergency services.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
