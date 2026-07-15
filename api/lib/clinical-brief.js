function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function clean(value, fallback = 'Not provided') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function list(items, empty = 'None listed') {
  const values = (items || []).map((item) => clean(item, '')).filter(Boolean)
  if (!values.length) return `<p class="muted">${escapeHtml(empty)}</p>`
  return `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function statusLabel(value) {
  const status = String(value || '').toLowerCase()
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'resolved') return 'Resolved'
  if (status === 'conflict') return 'Conflict'
  if (status === 'needs-review' || status === 'needs_review') return 'Needs review'
  return clean(value, 'Needs review')
}

function statusClass(value) {
  const status = String(value || '').toLowerCase()
  if (status === 'confirmed' || status === 'resolved') return 'ok'
  return 'warn'
}

function isAbnormalLab(item) {
  const flag = String(item?.abnormalFlag || '').trim().toLowerCase()
  return Boolean(flag && !['normal', 'none', 'negative', 'within range'].includes(flag))
}

function tableRows(items, render, columns, empty) {
  if (!items?.length) {
    return `<tr><td colspan="${columns}" class="muted">${escapeHtml(empty)}</td></tr>`
  }
  return items.map(render).join('')
}

function sourceIndex(sources) {
  if (!sources?.length) return '<p class="muted">No sources included.</p>'
  return sources.map((source, index) => `
    <article class="source" id="source-${index + 1}">
      <div class="source-number">S${index + 1}</div>
      <div>
        <h4>${escapeHtml(clean(source.title, `Source ${index + 1}`))}</h4>
        <p class="source-meta">${escapeHtml(clean(source.subtitle, 'Patient-provided source'))}</p>
        <p>${escapeHtml(clean(source.excerpt, 'No excerpt available.'))}</p>
      </div>
    </article>`).join('')
}

function priorityCards(priorities) {
  const items = (priorities || []).filter(Boolean)
  if (!items.length) return '<p class="muted">No visit priorities entered.</p>'
  return `<ol class="priority-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
}

export function buildClinicalBriefHtml(packet) {
  const patient = packet?.patient || {}
  const visit = packet?.visit || {}
  const medications = packet?.medications || []
  const labs = packet?.labs || []
  const reconciliation = packet?.reconciliation || []
  const openTasks = packet?.openTasks || []
  const unresolved = reconciliation.filter((item) => String(item?.status || '').toLowerCase() !== 'resolved')
  const medicationConflicts = medications.filter((item) => String(item?.status || '').toLowerCase() !== 'confirmed')
  const abnormalLabs = labs.filter(isAbnormalLab)
  const attentionCount = unresolved.length + medicationConflicts.length + abnormalLabs.length
  const prepared = clean(packet?.preparedAt, new Date().toISOString())

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vital Passport Clinical Brief - ${escapeHtml(clean(patient.name, 'Patient'))}</title>
<style>
  :root { color-scheme: light; --ink:#173b3a; --muted:#607372; --line:#d9e4df; --paper:#ffffff; --wash:#f4f7f4; --mint:#eaf4ef; --warn:#9b542f; --warn-bg:#fff4eb; --ok:#2f6b58; }
  * { box-sizing: border-box; }
  body { margin:0; background:#edf1ee; color:#1d2e2d; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; font-size:14px; line-height:1.45; }
  .page { max-width:980px; margin:28px auto; background:var(--paper); border:1px solid var(--line); border-radius:18px; box-shadow:0 18px 55px rgba(20,52,49,.08); overflow:hidden; }
  header { padding:30px 36px 24px; background:linear-gradient(135deg,#f3f8f5,#ffffff); border-bottom:1px solid var(--line); }
  .brand { color:var(--ok); font-weight:800; letter-spacing:.14em; text-transform:uppercase; font-size:11px; }
  h1 { margin:7px 0 4px; color:var(--ink); font-size:30px; line-height:1.15; }
  .subtitle { color:var(--muted); margin:0; }
  .identity { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:22px; }
  .identity div { background:#fff; border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .label { display:block; color:var(--muted); font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; margin-bottom:3px; }
  .value { color:var(--ink); font-weight:700; }
  main { padding:28px 36px 36px; }
  .alert { border:1px solid #efc5aa; background:var(--warn-bg); border-radius:12px; padding:16px 18px; margin-bottom:22px; }
  .alert h2 { color:#7a3e20; margin:0 0 7px; font-size:17px; }
  .alert p { margin:0; color:#714c38; }
  .all-clear { border-color:#bcd8ca; background:var(--mint); }
  .all-clear h2, .all-clear p { color:var(--ok); }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
  section { break-inside:avoid; margin-bottom:18px; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  section > h2 { margin:0; padding:12px 15px; background:var(--wash); color:var(--ink); font-size:15px; border-bottom:1px solid var(--line); }
  .section-body { padding:15px; }
  .reason { font-size:16px; color:#243d3b; margin:0; }
  .priority-list { margin:0; padding-left:22px; }
  .priority-list li { padding:5px 0; font-weight:650; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; color:var(--muted); font-size:10px; text-transform:uppercase; letter-spacing:.07em; padding:8px; border-bottom:1px solid var(--line); }
  td { vertical-align:top; padding:10px 8px; border-bottom:1px solid #edf1ef; }
  tr:last-child td { border-bottom:0; }
  .pill { display:inline-block; border-radius:999px; padding:3px 8px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
  .pill.ok { background:#e6f3ec; color:var(--ok); }
  .pill.warn { background:#fff0e6; color:var(--warn); }
  .flagged td { background:#fffaf6; }
  ul { margin:0; padding-left:20px; }
  li { margin:3px 0; }
  .muted { color:var(--muted); margin:0; }
  .source { display:grid; grid-template-columns:42px 1fr; gap:10px; padding:13px 0; border-bottom:1px solid #edf1ef; }
  .source:last-child { border-bottom:0; }
  .source-number { width:34px; height:34px; border-radius:50%; background:var(--mint); color:var(--ok); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:11px; }
  .source h4 { margin:0 0 2px; color:var(--ink); }
  .source p { margin:4px 0 0; }
  .source-meta { color:var(--muted); font-size:12px; }
  footer { padding:18px 36px 28px; color:var(--muted); font-size:11px; border-top:1px solid var(--line); background:#fbfcfb; }
  .wide { grid-column:1 / -1; }
  @media (max-width:760px) { .identity,.grid { grid-template-columns:1fr; } .wide { grid-column:auto; } header,main,footer { padding-left:20px; padding-right:20px; } }
  @media print { @page { size:letter; margin:.45in; } body { background:#fff; font-size:11px; } .page { max-width:none; margin:0; border:0; border-radius:0; box-shadow:none; } header { padding:0 0 18px; } main { padding:18px 0; } footer { padding:12px 0 0; } section { break-inside:avoid; } }
</style>
</head>
<body>
<div class="page">
<header>
  <div class="brand">Vital Passport</div>
  <h1>Patient-Controlled Pre-Visit Clinical Brief</h1>
  <p class="subtitle">Source-linked information prepared by the patient for clinician review and verification.</p>
  <div class="identity">
    <div><span class="label">Patient</span><span class="value">${escapeHtml(clean(patient.name))}</span></div>
    <div><span class="label">Date of birth</span><span class="value">${escapeHtml(clean(patient.dob))}</span></div>
    <div><span class="label">Visit</span><span class="value">${escapeHtml(clean(visit.label))}</span></div>
    <div><span class="label">Prepared</span><span class="value">${escapeHtml(prepared)}</span></div>
  </div>
</header>
<main>
  <div class="alert ${attentionCount ? '' : 'all-clear'}">
    <h2>${attentionCount ? `${attentionCount} item${attentionCount === 1 ? '' : 's'} need clinician attention` : 'No unresolved discrepancies detected'}</h2>
    <p>${attentionCount ? `${medicationConflicts.length} medication discrepancy, ${abnormalLabs.length} flagged lab result, and ${unresolved.length} unresolved reconciliation item. Review source details before changing treatment.` : 'The patient-entered record has no visible unresolved conflicts. All information still requires clinical verification.'}</p>
  </div>

  <div class="grid">
    <section>
      <h2>Reason for visit</h2>
      <div class="section-body"><p class="reason">${escapeHtml(clean(visit.reason))}</p></div>
    </section>
    <section>
      <h2>Patient priorities</h2>
      <div class="section-body">${priorityCards(packet?.priorities)}</div>
    </section>

    <section class="wide">
      <h2>Medication reconciliation</h2>
      <div class="section-body">
        <table>
          <thead><tr><th>Medication</th><th>Strength</th><th>Patient-reported directions</th><th>Status</th></tr></thead>
          <tbody>${tableRows(medications, (item) => `<tr class="${statusClass(item.status) === 'warn' ? 'flagged' : ''}"><td><strong>${escapeHtml(clean(item.name))}</strong></td><td>${escapeHtml(clean(item.strength, 'Not stated'))}</td><td>${escapeHtml(clean(item.directions, 'Not stated'))}</td><td><span class="pill ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td></tr>`, 4, 'No medications listed.')}</tbody>
        </table>
      </div>
    </section>

    <section class="wide">
      <h2>Reconciliation and discrepancies</h2>
      <div class="section-body">
        <table>
          <thead><tr><th>Issue</th><th>Detail</th><th>Status</th></tr></thead>
          <tbody>${tableRows(reconciliation, (item) => `<tr class="${statusClass(item.status) === 'warn' ? 'flagged' : ''}"><td><strong>${escapeHtml(clean(item.title))}</strong></td><td>${escapeHtml(clean(item.status === 'resolved' ? item.resolution : item.detail))}</td><td><span class="pill ${statusClass(item.status)}">${escapeHtml(statusLabel(item.status))}</span></td></tr>`, 3, 'No reconciliation issues identified.')}</tbody>
        </table>
      </div>
    </section>

    <section class="wide">
      <h2>Relevant laboratory results</h2>
      <div class="section-body">
        <table>
          <thead><tr><th>Date</th><th>Test</th><th>Result</th><th>Flag</th></tr></thead>
          <tbody>${tableRows(labs, (item) => `<tr class="${isAbnormalLab(item) ? 'flagged' : ''}"><td>${escapeHtml(clean(item.eventDate, 'Date not stated'))}</td><td><strong>${escapeHtml(clean(item.test))}</strong></td><td>${escapeHtml([item.value, item.unit].filter(Boolean).join(' ') || 'Not stated')}</td><td>${item.abnormalFlag ? `<span class="pill ${isAbnormalLab(item) ? 'warn' : 'ok'}">${escapeHtml(item.abnormalFlag)}</span>` : '<span class="muted">Not flagged</span>'}</td></tr>`, 4, 'No laboratory results included.')}</tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Conditions</h2>
      <div class="section-body">${list(patient.conditions)}</div>
    </section>
    <section>
      <h2>Allergies</h2>
      <div class="section-body">${list(patient.allergies, 'No allergies listed')}</div>
    </section>

    <section class="wide">
      <h2>Open next actions</h2>
      <div class="section-body">${openTasks.length ? `<ul>${openTasks.map((item) => `<li><strong>${escapeHtml(clean(item.title))}:</strong> ${escapeHtml(clean(item.detail))}</li>`).join('')}</ul>` : '<p class="muted">No open next actions.</p>'}</div>
    </section>

    <section class="wide">
      <h2>Source index</h2>
      <div class="section-body">${sourceIndex(packet?.sources)}</div>
    </section>
  </div>
</main>
<footer>
  ${escapeHtml(clean(packet?.disclaimer, 'Patient-provided information for clinician review. Not a diagnosis, medication order, or substitute for the source record.'))}
</footer>
</div>
</body>
</html>`
}

export function clinicalBriefFilename(patientName, at = new Date()) {
  const safeName = clean(patientName, 'patient')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'patient'
  const timestamp = at.toISOString().replace(/[:.]/g, '-').replace('T', '-').replace('Z', 'Z')
  return `Vital-Passport-Clinical-Brief-${safeName}-${timestamp}.html`
}
