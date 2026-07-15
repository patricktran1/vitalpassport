import type { PatientRecordSnapshot, SharedBriefPacket } from '../types'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character)
}

function fileStem(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'patient'
}

export function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadJson(fileName: string, value: unknown) {
  downloadFile(fileName, JSON.stringify(value, null, 2), 'application/json;charset=utf-8')
}

export function createClinicianPacketHtml(packet: SharedBriefPacket) {
  const medications = packet.medications.map((medication) => `
    <tr>
      <td>${escapeHtml(medication.name)}</td>
      <td>${escapeHtml([medication.strength, medication.directions].filter(Boolean).join(' · '))}</td>
      <td><span class="status ${escapeHtml(medication.status)}">${escapeHtml(medication.status.replace('_', ' '))}</span></td>
      <td>${medication.sourceCount}</td>
    </tr>`).join('')

  const labs = packet.labs.map((lab) => `
    <tr>
      <td>${escapeHtml(lab.eventDate)}</td>
      <td>${escapeHtml(lab.test)}</td>
      <td>${escapeHtml([lab.value, lab.unit].filter(Boolean).join(' '))}</td>
      <td>${escapeHtml(lab.abnormalFlag || 'Not flagged')}</td>
      <td>${escapeHtml(lab.trend || '')}</td>
    </tr>`).join('')

  const timeline = packet.timeline.map((event) => `
    <li><time>${escapeHtml(event.displayDate)}</time><div><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.summary)}</p><small>${escapeHtml(event.sourceLabel)}</small></div></li>`).join('')

  const tasks = packet.openTasks.length
    ? packet.openTasks.map((task) => `<li><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.detail)}</span>${task.dueLabel ? `<small>${escapeHtml(task.dueLabel)}</small>` : ''}</li>`).join('')
    : '<li>No open next actions.</li>'

  const reconciliation = packet.reconciliation.length
    ? packet.reconciliation.map((issue) => `<article class="issue ${issue.status}"><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.status === 'resolved' ? issue.resolution || 'Resolved' : issue.detail)}</p><small>${escapeHtml(issue.status)}</small></article>`).join('')
    : '<p>No active medication discrepancies were included.</p>'

  const sourceIndex = packet.sources.map((source, index) => `
    <details>
      <summary><span>${index + 1}</span>${escapeHtml(source.title)} <small>${escapeHtml(source.subtitle)}</small></summary>
      <p>${escapeHtml(source.excerpt)}</p>
      <dl>${source.details.map((detail) => `<div><dt>${escapeHtml(detail.label)}</dt><dd>${escapeHtml(detail.value)}</dd></div>`).join('')}</dl>
    </details>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(packet.patient.name)} · Vital Passport clinician packet</title>
<style>
:root{font-family:Arial,Helvetica,sans-serif;color:#183837;background:#f4f2ed}*{box-sizing:border-box}body{margin:0}.packet{max-width:980px;margin:32px auto;background:white;border:1px solid #dbe3df;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(24,56,55,.08)}header{padding:30px 36px;background:linear-gradient(120deg,#e3ece4,#eee9f4)}header .brand{font-size:11px;letter-spacing:.16em;font-weight:800}h1{margin:9px 0 5px;font-size:32px}header p{margin:0;color:#526765}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.pill,.status{display:inline-block;border-radius:999px;padding:6px 9px;background:#edf3ef;font-size:11px;font-weight:700}.status.conflict,.status.needs_review{background:#fff0e7;color:#8a4a37}.status.confirmed{background:#e8f3e9;color:#356743}main{padding:30px 36px}.notice{padding:14px 16px;border:1px solid #e6cfa8;background:#fff8e8;border-radius:12px;font-size:13px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.section{margin-top:28px}.section h2{font-size:17px;margin:0 0 12px}.section p{line-height:1.55}.priority-list li,.task-list li{margin:8px 0}.task-list li{display:grid;gap:3px;padding:12px;border:1px solid #e4e9e6;border-radius:10px}.task-list span,.task-list small{color:#667875}.issue{padding:13px;border:1px solid #e4e9e6;border-radius:10px;margin:8px 0}.issue.open{border-color:#e7c9b7;background:#fff7f2}.issue p{margin:6px 0}.issue small{text-transform:uppercase;letter-spacing:.08em}table{width:100%;border-collapse:collapse;font-size:12px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e8ecea;vertical-align:top}th{color:#61716f;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.timeline{list-style:none;padding:0}.timeline li{display:grid;grid-template-columns:65px 1fr;gap:12px;margin:12px 0}.timeline time{font-weight:700;color:#607370}.timeline p{margin:4px 0}.timeline small{color:#748481}.sources details{border-top:1px solid #e5eae7;padding:12px 0}.sources summary{cursor:pointer;font-weight:700}.sources summary span{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#edf2ef;margin-right:8px}.sources summary small{font-weight:400;color:#71807e;margin-left:6px}.sources dl div{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:7px 0}.sources dt{color:#687a77}.sources dd{margin:0}.footer{padding:18px 36px;background:#f6f8f6;color:#667875;font-size:11px;line-height:1.5}.actions{max-width:980px;margin:0 auto 30px;text-align:right}.actions button{border:0;border-radius:10px;background:#183837;color:white;padding:12px 17px;font-weight:700;cursor:pointer}@media(max-width:700px){.packet{margin:0;border-radius:0}.grid{grid-template-columns:1fr}header,main,.footer{padding-left:20px;padding-right:20px}.sources dl div{grid-template-columns:1fr}.actions{padding:16px;margin:0}.actions button{width:100%}}@media print{body{background:white}.packet{box-shadow:none;border:0;margin:0;max-width:none}.actions{display:none}.section{break-inside:avoid}details{display:block}details>*{display:block}}
</style>
</head>
<body>
<div class="actions"><button onclick="window.print()">Print or save as PDF</button></div>
<article class="packet">
<header>
  <div class="brand">VITAL PASSPORT · PATIENT-CONTROLLED CLINICAL HANDOFF</div>
  <h1>${escapeHtml(packet.patient.name)}</h1>
  <p>${escapeHtml(`${packet.patient.age} years old · DOB ${packet.patient.dob} · ${packet.patient.pronouns}`)}</p>
  <div class="meta"><span class="pill">Prepared ${escapeHtml(new Date(packet.preparedAt).toLocaleString())}</span><span class="pill">${packet.readiness.percent}% ready</span><span class="pill">${packet.medications.length} medications</span><span class="pill">${packet.labs.length} recent results</span></div>
</header>
<main>
  <div class="notice">${escapeHtml(packet.disclaimer)}</div>
  <section class="section"><h2>Reason for visit</h2><p>${escapeHtml(packet.visit.reason)}</p><small>${escapeHtml(packet.visit.label)}</small></section>
  <div class="grid">
    <section class="section"><h2>Patient priorities</h2><ol class="priority-list">${packet.priorities.map((priority) => `<li>${escapeHtml(priority)}</li>`).join('')}</ol></section>
    <section class="section"><h2>Relevant history</h2><p><strong>Conditions:</strong> ${escapeHtml(packet.patient.conditions.join(', '))}</p><p><strong>Allergies:</strong> ${escapeHtml(packet.patient.allergies.join(', '))}</p></section>
  </div>
  <section class="section"><h2>Medication reconciliation</h2><div>${reconciliation}</div></section>
  <section class="section"><h2>Current medications</h2><table><thead><tr><th>Medication</th><th>Instructions</th><th>Status</th><th>Sources</th></tr></thead><tbody>${medications}</tbody></table></section>
  <section class="section"><h2>Relevant results</h2><table><thead><tr><th>Date</th><th>Test</th><th>Result</th><th>Flag</th><th>Trend</th></tr></thead><tbody>${labs}</tbody></table></section>
  <div class="grid">
    <section class="section"><h2>Relevant timeline</h2><ol class="timeline">${timeline}</ol></section>
    <section class="section"><h2>Open next actions</h2><ul class="task-list">${tasks}</ul></section>
  </div>
  <section class="section sources"><h2>Source index</h2>${sourceIndex}</section>
</main>
<footer class="footer">Generated by Vital Passport from patient-provided and source-linked information. This export does not diagnose, recommend treatment, or replace the original medical record.</footer>
</article>
</body>
</html>`
}

export function downloadClinicianPacket(packet: SharedBriefPacket) {
  downloadFile(`${fileStem(packet.patient.name)}-vital-passport-clinician-packet.html`, createClinicianPacketHtml(packet), 'text/html;charset=utf-8')
}

export function downloadPatientRecordBackup(patientName: string, snapshot: PatientRecordSnapshot) {
  downloadJson(`${fileStem(patientName)}-vital-passport-backup.json`, {
    exportType: 'vital-passport-patient-record-backup',
    exportedAt: new Date().toISOString(),
    record: snapshot,
  })
}
