import { Activity, Check, CheckCircle2, ChevronRight, Clock3, Database, HeartPulse, Link2, Moon, RefreshCw, ShieldCheck, Trash2, Unplug, Watch } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  appleHealthCategoryMeta,
  defaultAppleHealthPermissions,
  useAppleHealthDemo,
  type AppleHealthCategory,
  type AppleHealthDay,
} from '../context/AppleHealthDemoContext'

function formatDate(value: string, includeTime = false) {
  if (!value) return 'Not synced'
  return new Intl.DateTimeFormat('en-US', includeTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(new Date(value))
}

function MetricLine({ days, field, label, unit }: {
  days: AppleHealthDay[]
  field: 'sleepHours' | 'restingHeartRate'
  label: string
  unit: string
}) {
  const values = days.map((day) => day[field])
  if (values.length < 2) return <div className="apple-health-chart-empty">Connect the demo to load trend data.</div>
  const width = 460
  const height = 120
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const points = values.map((value, index) => {
    const x = index * (width / (values.length - 1))
    const y = height - 12 - ((value - min) / range) * (height - 24)
    return `${x},${y}`
  }).join(' ')
  return <div className="apple-health-chart-wrap">
    <div className="apple-health-chart-label"><strong>{label}</strong><span>{values[values.length - 1]} {unit} latest</span></div>
    <svg className="apple-health-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} demo trend`}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      {values.map((value, index) => {
        const x = index * (width / (values.length - 1))
        const y = height - 12 - ((value - min) / range) * (height - 24)
        return <circle key={`${field}-${index}`} cx={x} cy={y} r="4" fill="currentColor"><title>{`${formatDate(days[index].date)}: ${value} ${unit}`}</title></circle>
      })}
    </svg>
    <div className="apple-health-chart-axis"><span>{formatDate(days[0].date)}</span><span>{formatDate(days[days.length - 1].date)}</span></div>
  </div>
}

function PermissionPicker({ selected, onChange }: { selected: AppleHealthCategory[]; onChange: (next: AppleHealthCategory[]) => void }) {
  const toggle = (category: AppleHealthCategory) => {
    const next = selected.includes(category) ? selected.filter((item) => item !== category) : [...selected, category]
    if (next.length) onChange(next)
  }
  return <div className="apple-health-permissions">
    {appleHealthCategoryMeta.map((category) => {
      const active = selected.includes(category.key)
      return <button type="button" className={active ? 'selected' : ''} key={category.key} onClick={() => toggle(category.key)}>
        <span className="apple-health-permission-check">{active ? <Check size={15}/> : null}</span>
        <span><strong>{category.label}</strong><small>{category.detail}</small></span>
      </button>
    })}
  </div>
}

export function AppleHealthDemo() {
  const {
    status,
    permissions,
    days,
    syncHistory,
    lastSyncAt,
    importedSampleCount,
    connectDemo,
    updatePermissions,
    syncNow,
    disconnectDemo,
    clearImportedData,
  } = useAppleHealthDemo()
  const [selected, setSelected] = useState<AppleHealthCategory[]>(permissions.length ? permissions : defaultAppleHealthPermissions)

  useEffect(() => setSelected(permissions), [permissions])

  const latest = days[days.length - 1]
  const orderedDays = useMemo(() => [...days].sort((a, b) => a.date.localeCompare(b.date)), [days])
  const recentAverage = useMemo(() => {
    const recent = orderedDays.slice(-3)
    return recent.length ? Math.round((recent.reduce((sum, day) => sum + day.sleepHours, 0) / recent.length) * 10) / 10 : null
  }, [orderedDays])

  if (status === 'disconnected') return <div className="page apple-health-page">
    <section className="page-heading split-heading">
      <div><div className="eyebrow">Wearable data connection</div><h1>Connect Apple Health</h1><p>Preview how Vital Passport could import sleep and heart data through a future native HealthKit companion.</p></div>
      <span className="demo-mode-chip">Demo only</span>
    </section>

    <section className="apple-health-connect-hero">
      <span className="apple-health-heart"><HeartPulse size={36}/></span>
      <div>
        <div className="eyebrow">Apple Health demo</div>
        <h2>Turn wearable measurements into a reviewable health story.</h2>
        <p>This browser demo simulates authorization and imports fourteen days of synthetic Apple Watch summaries. It does not contact Apple, HealthKit, an iPhone, or any external API.</p>
      </div>
    </section>

    <div className="apple-health-connect-grid">
      <section className="apple-health-permission-panel">
        <div className="section-mini-heading"><ShieldCheck size={18}/><strong>Choose what to share</strong><span>Each category is independently permissioned.</span></div>
        <PermissionPicker selected={selected} onChange={setSelected}/>
        <button className="button primary apple-health-connect-button" onClick={() => connectDemo(selected)}><Link2 size={17}/> Connect demo Apple Health</button>
        <p className="apple-health-fine-print">A real integration would request these permissions inside an iPhone app. Vital Passport would receive only the categories the patient approves.</p>
      </section>

      <aside className="apple-health-explainer">
        <div><Watch size={20}/><span><strong>Source-aware</strong><small>Preserves device, app, dates, and manual-entry status.</small></span></div>
        <div><Database size={20}/><span><strong>Normalized summaries</strong><small>Stores useful daily aggregates instead of flooding the record with raw samples.</small></span></div>
        <div><ShieldCheck size={20}/><span><strong>Patient reviewed</strong><small>Detected patterns still go through Health Inbox before joining the confirmed story.</small></span></div>
        <div className="apple-health-boundary"><strong>Integration boundary</strong><p>The demo adapter can later be replaced by native HealthKit, another wearable API, or an imported health-data file while keeping the same normalized schema.</p></div>
      </aside>
    </div>
  </div>

  return <div className="page apple-health-page">
    <section className="page-heading split-heading">
      <div><div className="eyebrow">Connected health data</div><h1>Apple Health demo</h1><p>Synthetic Apple Watch data flowing through the same provenance and patient-review boundaries planned for the real integration.</p></div>
      <div className="apple-health-header-actions"><span className="apple-health-connected"><CheckCircle2 size={16}/> Connected demo</span><button className="button ghost" onClick={syncNow}><RefreshCw size={16}/> Sync now</button></div>
    </section>

    <section className="apple-health-sync-banner">
      <span><Watch size={25}/></span>
      <div><div className="eyebrow">Maria’s Apple Watch</div><h2>{orderedDays.length} days imported</h2><p>{importedSampleCount.toLocaleString()} simulated source samples summarized · Last sync {formatDate(lastSyncAt || '', true)}</p></div>
      <Link to="/signals" className="button light">View generated signals <ChevronRight size={16}/></Link>
    </section>

    {latest && <section className="apple-health-latest-grid">
      <article><span><Moon size={19}/></span><div><small>Latest sleep</small><strong>{latest.sleepHours}<em> hr</em></strong><p>Three-night average {recentAverage} hr</p></div></article>
      <article><span><HeartPulse size={19}/></span><div><small>Resting heart rate</small><strong>{latest.restingHeartRate}<em> bpm</em></strong><p>Sleeping average {latest.sleepingHeartRate} bpm</p></div></article>
      <article><span><Activity size={19}/></span><div><small>Heart-rate range</small><strong>{latest.heartRateMin}–{latest.heartRateMax}<em> bpm</em></strong><p>Daily summarized range</p></div></article>
      <article><span><Clock3 size={19}/></span><div><small>Heart-rate variability</small><strong>{latest.hrvMs}<em> ms</em></strong><p>Daily demo summary</p></div></article>
    </section>}

    <section className="apple-health-chart-grid">
      <article><MetricLine days={orderedDays} field="sleepHours" label="Sleep duration" unit="hours"/></article>
      <article><MetricLine days={orderedDays} field="restingHeartRate" label="Resting heart rate" unit="bpm"/></article>
    </section>

    {latest && <section className="apple-health-detail-grid">
      <article className="apple-health-sleep-card">
        <div className="section-mini-heading"><Moon size={18}/><strong>Latest sleep stages</strong><span>{formatDate(latest.date)}</span></div>
        <div className="sleep-stage-bar" aria-label="Latest sleep stage breakdown">
          <span className="core" style={{ flex: latest.coreHours }} title={`Core ${latest.coreHours} hr`}/>
          <span className="deep" style={{ flex: latest.deepHours }} title={`Deep ${latest.deepHours} hr`}/>
          <span className="rem" style={{ flex: latest.remHours }} title={`REM ${latest.remHours} hr`}/>
          <span className="awake" style={{ flex: latest.awakeHours }} title={`Awake ${latest.awakeHours} hr`}/>
        </div>
        <div className="sleep-stage-legend">
          <span><i className="core"/>Core <b>{latest.coreHours} hr</b></span><span><i className="deep"/>Deep <b>{latest.deepHours} hr</b></span><span><i className="rem"/>REM <b>{latest.remHours} hr</b></span><span><i className="awake"/>Awake <b>{latest.awakeHours} hr</b></span>
        </div>
      </article>

      <article className="apple-health-source-card">
        <div className="section-mini-heading"><ShieldCheck size={18}/><strong>Provenance</strong><span>Retained with every day.</span></div>
        <dl><div><dt>Source device</dt><dd>{latest.sourceDevice}</dd></div><div><dt>Source app</dt><dd>{latest.sourceApp}</dd></div><div><dt>Manually entered</dt><dd>{latest.manuallyEntered ? 'Yes' : 'No'}</dd></div><div><dt>Storage mode</dt><dd>Browser-local demo</dd></div></dl>
      </article>
    </section>}

    <div className="apple-health-management-grid">
      <section className="apple-health-permission-panel connected">
        <div className="section-mini-heading"><ShieldCheck size={18}/><strong>Shared categories</strong><span>Changes apply to the next demo sync.</span></div>
        <PermissionPicker selected={selected} onChange={setSelected}/>
        <button className="button light" onClick={() => updatePermissions(selected)}><Check size={16}/> Save permissions</button>
      </section>

      <section className="apple-health-sync-history">
        <div className="section-mini-heading"><RefreshCw size={18}/><strong>Sync history</strong><span>Visible import receipts.</span></div>
        <div>{syncHistory.slice(0, 6).map((receipt) => <article key={receipt.id}><CheckCircle2 size={16}/><span><strong>{formatDate(receipt.completedAt, true)}</strong><small>{receipt.sampleCount.toLocaleString()} samples · {receipt.dayCount} days · {receipt.categories.length} categories</small></span><em>Demo</em></article>)}</div>
        {!syncHistory.length && <p>No sync receipts remain.</p>}
      </section>
    </div>

    <section className="apple-health-data-controls">
      <div><ShieldCheck size={18}/><span><strong>Patient-controlled connection</strong><small>Disconnecting stops future demo syncs. Imported data can be removed separately.</small></span></div>
      <div><button className="button ghost" onClick={disconnectDemo}><Unplug size={16}/> Disconnect</button><button className="button ghost danger" onClick={clearImportedData}><Trash2 size={16}/> Remove imported data</button></div>
    </section>
  </div>
}
