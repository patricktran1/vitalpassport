import { Braces, CheckCircle2, Download, FileArchive, FileHeart, FileJson, Info, ShieldCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useVital } from '../context/VitalContext'
import { patient } from '../data/demo'
import { buildSharedBriefPacket } from '../lib/briefPacket'
import { buildFhirR4Bundle } from '../lib/fhirExport'
import { downloadClinicianPacket, downloadJson, downloadPatientRecordBackup } from '../lib/portableExport'
import type { PatientRecordSnapshot } from '../types'

function formatResourceName(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function Transfer() {
  const vital = useVital()
  const [lastExport, setLastExport] = useState('')

  const packet = useMemo(() => buildSharedBriefPacket({
    answers: vital.answers,
    readiness: vital.readiness,
    openGapCount: vital.openGapCount,
    resolvedCount: vital.resolvedCount,
    openReconciliationCount: vital.openReconciliationCount,
    medicationSummaries: vital.medicationSummaries,
    labResults: vital.labResults,
    reconciliationIssues: vital.reconciliationIssues,
    careTasks: vital.careTasks,
    sources: vital.sources,
    timelineEvents: vital.timelineEvents,
  }), [
    vital.answers,
    vital.readiness,
    vital.openGapCount,
    vital.resolvedCount,
    vital.openReconciliationCount,
    vital.medicationSummaries,
    vital.labResults,
    vital.reconciliationIssues,
    vital.careTasks,
    vital.sources,
    vital.timelineEvents,
  ])

  const fhirExport = useMemo(() => buildFhirR4Bundle(packet), [packet])

  const snapshot = useMemo<PatientRecordSnapshot>(() => ({
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    answers: vital.answers,
    uploads: vital.uploads,
    sources: vital.sources,
    timelineEvents: vital.timelineEvents,
    clinicalMedications: vital.clinicalMedications,
    labResults: vital.labResults,
    reconciliationIssues: vital.reconciliationIssues,
    careTasks: vital.careTasks,
  }), [
    vital.answers,
    vital.uploads,
    vital.sources,
    vital.timelineEvents,
    vital.clinicalMedications,
    vital.labResults,
    vital.reconciliationIssues,
    vital.careTasks,
  ])

  const exportPacket = () => {
    downloadClinicianPacket(packet)
    setLastExport('Clinician packet downloaded')
  }

  const exportFhir = () => {
    downloadJson('maria-santos-vital-passport-fhir-r4.json', fhirExport.bundle)
    setLastExport('FHIR R4 Bundle downloaded')
  }

  const exportBackup = () => {
    downloadPatientRecordBackup(patient.name, snapshot)
    setLastExport('Complete patient backup downloaded')
  }

  const ready = vital.openGapCount === 0 && vital.openReconciliationCount === 0
  const totalResources = Object.values(fhirExport.resourceCounts).reduce((sum, count) => sum + count, 0)

  return <div className="page transfer-page">
    <section className="page-heading split-heading">
      <div>
        <div className="eyebrow">Portable clinical handoff</div>
        <h1>Transfer center</h1>
        <p>Move the patient story without flattening it. Export a readable clinic packet, a structured FHIR R4 Bundle, or a complete patient-owned backup.</p>
      </div>
      <div className={`transfer-readiness ${ready ? 'ready' : 'attention'}`}>
        {ready ? <CheckCircle2 size={20}/> : <TriangleAlert size={20}/>} 
        <span><strong>{ready ? 'Record reconciled' : 'Uncertainty preserved'}</strong><small>{ready ? 'Ready for a clean handoff' : `${vital.openGapCount} interview gaps · ${vital.openReconciliationCount} source conflicts`}</small></span>
      </div>
    </section>

    <section className="transfer-hero">
      <div>
        <span className="transfer-hero-icon"><FileHeart size={25}/></span>
        <div><div className="eyebrow">One record, three formats</div><h2>Choose the artifact that matches the destination.</h2><p>Every export is generated in the browser from the current reconciled record. No new server or account is required.</p></div>
      </div>
      <div className="transfer-metrics">
        <div><strong>{packet.medications.length}</strong><span>medications</span></div>
        <div><strong>{packet.labs.length}</strong><span>recent labs</span></div>
        <div><strong>{packet.sources.length}</strong><span>linked sources</span></div>
        <div><strong>{totalResources}</strong><span>FHIR resources</span></div>
      </div>
    </section>

    <div className="export-card-grid">
      <article className="export-card primary-export">
        <div className="export-card-icon"><FileHeart size={24}/></div>
        <div className="export-format">HTML · PRINTABLE</div>
        <h2>Clinician packet</h2>
        <p>A polished, self-contained handoff that opens in any browser and can be printed or saved as a PDF.</p>
        <ul><li>One-minute clinical summary</li><li>Medication reconciliation</li><li>Labs, timeline, tasks, and source index</li></ul>
        <button className="button primary full" onClick={exportPacket}><Download size={17}/> Download clinic packet</button>
      </article>

      <article className="export-card">
        <div className="export-card-icon fhir"><Braces size={24}/></div>
        <div className="export-format">FHIR R4 · JSON</div>
        <h2>Structured health Bundle</h2>
        <p>A FHIR R4 collection Bundle for interoperability demonstrations, future EHR import, and developer testing.</p>
        <ul><li>Patient, conditions, allergies, medications</li><li>Lab Observations and follow-up Tasks</li><li>DocumentReferences and Provenance</li></ul>
        <button className="button ghost full" onClick={exportFhir}><FileJson size={17}/> Download FHIR Bundle</button>
      </article>

      <article className="export-card">
        <div className="export-card-icon backup"><FileArchive size={24}/></div>
        <div className="export-format">VITAL PASSPORT · JSON</div>
        <h2>Complete patient backup</h2>
        <p>The full patient-owned application record, including uploads, source graph, reconciliation decisions, and tasks.</p>
        <ul><li>Versioned snapshot format</li><li>Restorable product state</li><li>Independent of Supabase</li></ul>
        <button className="button ghost full" onClick={exportBackup}><Download size={17}/> Download full backup</button>
      </article>
    </div>

    {lastExport && <div className="export-success"><CheckCircle2 size={17}/><span>{lastExport}. The patient retains the original record.</span></div>}

    <div className="transfer-detail-grid">
      <section className="card fhir-inventory">
        <div className="card-heading"><div><div className="eyebrow">FHIR inventory</div><h2>Resources included</h2></div><span className="soft-icon"><Braces size={20}/></span></div>
        <div className="resource-count-list">
          {Object.entries(fhirExport.resourceCounts).sort(([a],[b])=>a.localeCompare(b)).map(([resourceType,count])=><div key={resourceType}><span>{formatResourceName(resourceType)}</span><strong>{count}</strong></div>)}
        </div>
        <div className="fhir-note"><Info size={16}/><span>This is a FHIR R4 <strong>collection</strong> Bundle, designed for transport and demonstration. It is not automatically posted to an EHR or certified against a receiving implementation guide.</span></div>
      </section>

      <section className="card export-safety-card">
        <div className="card-heading"><div><div className="eyebrow">Handoff integrity</div><h2>What Vital Passport preserves</h2></div><span className="soft-icon"><ShieldCheck size={20}/></span></div>
        <div className="integrity-list">
          <div><CheckCircle2 size={17}/><span><strong>Patient control</strong><small>The export is initiated by the patient and creates a copy.</small></span></div>
          <div><CheckCircle2 size={17}/><span><strong>Source provenance</strong><small>Document references and provenance travel with structured facts.</small></span></div>
          <div><CheckCircle2 size={17}/><span><strong>Visible uncertainty</strong><small>Conflicts are exported as unknown or review-needed, never silently resolved.</small></span></div>
        </div>
        {fhirExport.warnings.length > 0 && <div className="export-warning-list"><strong>Export warnings</strong>{fhirExport.warnings.map((warning)=><div key={warning}><TriangleAlert size={14}/><span>{warning}</span></div>)}</div>}
      </section>
    </div>

    <div className="transfer-footer-note"><ShieldCheck size={17}/><span>These files can contain sensitive health information. Store and transmit them only through channels the patient trusts.</span></div>
  </div>
}
