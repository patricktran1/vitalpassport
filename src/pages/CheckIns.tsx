import { BellRing, CalendarClock, CheckCircle2, Clock3, Mail, MessageSquareText, MonitorDot, Plus, ShieldCheck, Smartphone, Trash2 } from 'lucide-react'
import { useCheckIns, type CheckInFocus, type CheckInSchedule } from '../context/CheckInContext'

const focusLabels: Record<CheckInFocus, string> = {
  general: 'General wellbeing',
  mental_health: 'Mood and mental health',
  symptoms: 'Symptoms',
  blood_pressure: 'Blood pressure',
  diabetes: 'Diabetes',
  medication: 'Medication experience',
}

const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatDue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Schedule pending'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function CheckIns() {
  const {
    schedules,
    responses,
    nextSchedule,
    dueCount,
    notificationPermission,
    addSchedule,
    updateSchedule,
    removeSchedule,
    startCheckIn,
    requestBrowserNotifications,
  } = useCheckIns()

  const toggleBrowser = async (schedule: CheckInSchedule) => {
    if (schedule.channels.includes('browser')) {
      updateSchedule(schedule.id, { channels: schedule.channels.filter((channel) => channel !== 'browser') })
      return
    }
    const permission = await requestBrowserNotifications()
    if (permission === 'granted') updateSchedule(schedule.id, { channels: [...schedule.channels, 'browser'] })
  }

  return (
    <div className="page checkins-page">
      <section className="page-heading split-heading">
        <div>
          <div className="eyebrow">Patient-controlled follow-up</div>
          <h1>Health check-ins</h1>
          <p>Let Vital Passport ask the right question at the right time, then route your response through Health Inbox before it changes your record.</p>
        </div>
        <button className="button primary" onClick={addSchedule}><Plus size={17}/> Add check-in</button>
      </section>

      <section className={`checkin-status-hero ${dueCount ? 'due' : ''}`}>
        <span><BellRing size={27}/></span>
        <div>
          <div className="eyebrow">Next check-in</div>
          <h2>{dueCount ? `${dueCount} ${dueCount === 1 ? 'check-in is' : 'check-ins are'} ready` : nextSchedule?.title || 'No active check-ins'}</h2>
          <p>{dueCount ? 'A check-in is waiting for your response.' : nextSchedule ? `${nextSchedule.prompt} · ${formatDue(nextSchedule.nextDueAt)}` : 'Enable a schedule when you want Vital Passport to follow up.'}</p>
        </div>
        {nextSchedule && <button className="button light" onClick={() => startCheckIn(nextSchedule.id)}>Check in now</button>}
      </section>

      <div className="checkin-page-grid">
        <section className="checkin-schedule-stack">
          <div className="section-mini-heading"><CalendarClock size={18}/><strong>Your schedules</strong><span>Each schedule stays under your control.</span></div>
          {schedules.map((schedule) => (
            <article className={`checkin-schedule-card ${schedule.enabled ? '' : 'disabled'}`} key={schedule.id}>
              <div className="checkin-card-top">
                <div className="checkin-enabled-toggle">
                  <input id={`enabled-${schedule.id}`} type="checkbox" checked={schedule.enabled} onChange={(event) => updateSchedule(schedule.id, { enabled: event.target.checked })}/>
                  <label htmlFor={`enabled-${schedule.id}`}>{schedule.enabled ? 'Active' : 'Paused'}</label>
                </div>
                <button className="icon-button" onClick={() => removeSchedule(schedule.id)} aria-label={`Delete ${schedule.title}`}><Trash2 size={17}/></button>
              </div>

              <input className="checkin-title-input" value={schedule.title} onChange={(event) => updateSchedule(schedule.id, { title: event.target.value })}/>
              <textarea className="checkin-prompt-input" value={schedule.prompt} rows={2} onChange={(event) => updateSchedule(schedule.id, { prompt: event.target.value })}/>

              <div className="checkin-fields">
                <label><span>Focus</span><select value={schedule.focus} onChange={(event) => updateSchedule(schedule.id, { focus: event.target.value as CheckInFocus })}>{Object.entries(focusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label><span>Cadence</span><select value={schedule.cadence} onChange={(event) => updateSchedule(schedule.id, { cadence: event.target.value as CheckInSchedule['cadence'] })}><option value="daily">Daily</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option></select></label>
                {schedule.cadence === 'weekly' && <label><span>Day</span><select value={schedule.weekday} onChange={(event) => updateSchedule(schedule.id, { weekday: Number(event.target.value) })}>{weekdayLabels.map((label, index) => <option value={index} key={label}>{label}</option>)}</select></label>}
                <label><span>Time</span><input type="time" value={schedule.time} onChange={(event) => updateSchedule(schedule.id, { time: event.target.value })}/></label>
              </div>

              <div className="checkin-delivery-row">
                <div className="delivery-chip active"><MonitorDot size={15}/><span>In-app</span><CheckCircle2 size={14}/></div>
                <button className={`delivery-chip ${schedule.channels.includes('browser') ? 'active' : ''}`} onClick={() => void toggleBrowser(schedule)}><Smartphone size={15}/><span>Browser alert</span>{schedule.channels.includes('browser') && <CheckCircle2 size={14}/>}</button>
                <span className="checkin-next-due"><Clock3 size={14}/>{formatDue(schedule.nextDueAt)}</span>
              </div>

              <div className="checkin-card-actions">
                <button className="button ghost" onClick={() => startCheckIn(schedule.id)}>Check in now</button>
                {schedule.lastCompletedAt && <small>Last completed {formatDue(schedule.lastCompletedAt)}</small>}
              </div>
            </article>
          ))}
        </section>

        <aside className="checkin-delivery-panel">
          <div className="section-mini-heading"><MessageSquareText size={18}/><strong>Delivery channels</strong><span>Start local. Add cloud delivery deliberately.</span></div>
          <div className="delivery-option ready"><MonitorDot size={20}/><div><strong>In-app prompts</strong><span>Active now. Opens a calm check-in inside Vital Passport.</span></div><em>Ready</em></div>
          <div className={`delivery-option ${notificationPermission === 'granted' ? 'ready' : ''}`}><Smartphone size={20}/><div><strong>Browser notifications</strong><span>{notificationPermission === 'granted' ? 'Permission granted on this device.' : notificationPermission === 'denied' ? 'Blocked in browser settings.' : 'Optional alerts while the browser can deliver them.'}</span></div><em>{notificationPermission === 'granted' ? 'Ready' : 'Optional'}</em></div>
          <div className="delivery-option locked"><Mail size={20}/><div><strong>Email reminders</strong><span>Requires secure account storage plus a transactional email service.</span></div><em>Cloud activation</em></div>
          <div className="delivery-option locked"><MessageSquareText size={20}/><div><strong>Text reminders</strong><span>Requires verified consent, phone storage, opt-out handling, and an SMS service.</span></div><em>Cloud activation</em></div>
          <div className="checkin-cloud-note"><ShieldCheck size={17}/><span>Email and text preferences are intentionally not faked with browser-only storage. Supabase and a delivery service are the next infrastructure gate.</span></div>
        </aside>
      </div>

      <section className="card checkin-history-card">
        <div className="card-heading"><div><div className="eyebrow">Recent responses</div><h2>Check-in history</h2></div><span className="soft-icon"><BellRing size={20}/></span></div>
        {responses.length ? <div className="checkin-history-list">{responses.slice(0,8).map((response) => <div key={response.id}><span>{focusLabels[response.focus]}</span><strong>{response.response}</strong><small>{formatDue(response.createdAt)} · Sent to Health Inbox for review</small></div>)}</div> : <div className="checkin-history-empty"><BellRing size={19}/><span>Your completed check-ins will appear here.</span></div>}
      </section>
    </div>
  )
}
