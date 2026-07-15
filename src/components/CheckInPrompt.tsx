import { BellRing, Bot, Clock3, HeartPulse, ShieldCheck, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useCheckIns } from '../context/CheckInContext'
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

export function CheckInPrompt() {
  const { activeSchedule, completeCheckIn, snoozeActive } = useCheckIns()
  const [response, setResponse] = useState('')

  useEffect(() => setResponse(''), [activeSchedule?.id])

  if (!activeSchedule) return null

  const appendTranscript = (transcript: string) => {
    setResponse((current) => [current.trim(), transcript].filter(Boolean).join(' '))
  }

  const save = (talkWithCopilot: boolean) => {
    if (!response.trim()) return
    completeCheckIn(response)
    if (talkWithCopilot) {
      window.setTimeout(() => openCopilotDrawer('What is pending from my latest health check-in? Help me review what changed, preserve uncertainty, and ask one gentle follow-up question at a time.'), 120)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    save(false)
  }

  return (
    <div className="checkin-prompt-backdrop" role="presentation">
      <section className="checkin-prompt" role="dialog" aria-modal="true" aria-labelledby="checkin-prompt-title">
        <header>
          <span className="checkin-prompt-icon"><BellRing size={22}/></span>
          <div><small>Vital Passport check-in</small><strong id="checkin-prompt-title">{activeSchedule.title}</strong></div>
          <button type="button" className="icon-button" onClick={() => snoozeActive(60)} aria-label="Snooze check-in for one hour"><X size={20}/></button>
        </header>

        <div className="checkin-prompt-body">
          <div className="checkin-focus-pill"><HeartPulse size={15}/>{focusLabels[activeSchedule.focus]}</div>
          <h2>{activeSchedule.prompt}</h2>
          <p>Answer in your own words. Your response goes to Health Inbox first so you can review it before it becomes part of your confirmed health memory.</p>

          <form onSubmit={submit}>
            <div className="checkin-response-box">
              <textarea value={response} onChange={(event) => setResponse(event.target.value)} rows={5} maxLength={2400} placeholder="Type what you notice, or use the microphone…" autoFocus />
              <VoiceInputButton onTranscript={appendTranscript} label="Record a voice response" />
            </div>
            <div className="checkin-prompt-actions">
              <button type="button" className="button ghost" onClick={() => snoozeActive(60)}><Clock3 size={16}/> Not now</button>
              <button type="submit" className="button light" disabled={!response.trim()}><ShieldCheck size={16}/> Save to Health Inbox</button>
              <button type="button" className="button primary" disabled={!response.trim()} onClick={() => save(true)}><Bot size={16}/> Talk it through</button>
            </div>
          </form>

          <div className="checkin-safety-note">
            <ShieldCheck size={15}/>
            <span>This is a scheduled reflection, not continuous monitoring. For immediate danger or a medical emergency, contact local emergency services.</span>
          </div>
        </div>
      </section>
    </div>
  )
}
