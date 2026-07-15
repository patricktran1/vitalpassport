import { ArrowRight, CheckCircle2, Database, ExternalLink, FileText, LoaderCircle, Search, ShieldCheck, TriangleAlert, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useVital } from '../context/VitalContext'
import { patient } from '../data/demo'
import { buildSharedBriefPacket } from '../lib/briefPacket'
import {
  beginOpenEmrAuthorization,
  createDemoOpenEmrReceipt,
  demoOpenEmrDiscovery,
  demoOpenEmrPatients,
  disconnectOpenEmr,
  discoverOpenEmr,
  getOpenEmrConfig,
  importOpenEmrPacket,
  readLastOpenEmrReceipt,
  readOpenEmrToken,
  searchOpenEmrPatients,
  type OpenEmrConfig,
  type OpenEmrDiscovery,
  type OpenEmrImportOptions,
  type OpenEmrImportReceipt,
  type OpenEmrPatient,
} from '../lib/openemr'

function isoDob(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function OpenEmr() {
  const vital = useVital()
  const [config, setConfig] = useState<OpenEmrConfig | null>(null)
  const [discovery, setDiscovery] = useState<OpenEmrDiscovery | null>(null)
  const [connected, setConnected] = useState(Boolean(readOpenEmrToken()))
  const [demoConnected, setDemoConnected] = useState(false)
  const [name, setName] = useState(patient.name)
  const [birthDate, setBirthDate] = useState(isoDob(patient.dob))
  const [patients, setPatients] = useState<OpenEmrPatient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<OpenEmrPatient | null>(null)
  const [options, setOptions] = useState<OpenEmrImportOptions>({ includeLabs: true, includeConditions: false, includeAllergies: false, includeProvenance: true })
  const [receipt, setReceipt] = useState<OpenEmrImportReceipt | null>(() => readLastOpenEmrReceipt())
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

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
  }), [vital.answers, vital.readiness, vital.openGapCount, vital.resolvedCount, vital.openReconciliationCount, vital.medicationSummaries, vital.labResults, vital.reconciliationIssues, vital.careTasks, vital.sources, vital.timelineEvents])

  useEffect(() => {
    void getOpenEmrConfig().then(setConfig).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load OpenEMR configuration.'))
  }, [])

  const demoMode = config ? !config.configured : false
  const isConnected = demoMode ? demoConnected : connected

  const inspect = async () => {
    setLoading('discover')
    setError('')
    try {
      setDiscovery(demoMode ? demoOpenEmrDiscovery : await discoverOpenEmr())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not inspect OpenEMR.')
    } finally {
      setLoading('')
    }
  }

  const connect = async () => {
    setError('')
    if (demoMode) {
      setDiscovery(demoOpenEmrDiscovery)
      setDemoConnected(true)
      return
    }
    if (!config) return
    setLoading('connect')
    try {
      const nextDiscovery = discovery || await discoverOpenEmr()
      setDiscovery(nextDiscovery)
      await beginOpenEmrAuthorization(config, nextDiscovery)
    } catch (caught) {
      setLoading('')
      setError(caught instanceof Error ? caught.message : 'Could not start OpenEMR authorization.')
    }
  }

  const disconnect = () => {
    disconnectOpenEmr()
    setConnected(false)
    setDemoConnected(false)
    setPatients([])
    setSelectedPatient(null)
  }

  const searchPatients = async () => {
    setLoading('search')
    setError('')
    setSelectedPatient(null)
    try {
      const results = demoMode
        ? demoOpenEmrPatients.filter((item) => item.name.toLowerCase().includes(name.toLowerCase()) || item.birthDate === birthDate)
        : await searchOpenEmrPatients({ name, birthDate })
      setPatients(results)
      if (results.length === 1) setSelectedPatient(results[0])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Patient search failed.')
    } finally {
      setLoading('')
    }
  }

  const importPacket = async () => {
    if (!selectedPatient) return
    setLoading('import')
    setError('')
    try {
      const nextReceipt = demoMode
        ? createDemoOpenEmrReceipt(selectedPatient.id, packet, options)
        : await importOpenEmrPacket(selectedPatient.id, packet, options)
      setReceipt(nextReceipt)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'OpenEMR import failed.')
    } finally {
      setLoading('')
    }
  }

  const advertisedCreate = discovery ? Object.entries(discovery.interactions).filter(([, interactions]) => interactions.includes('create')).map(([resource]) => resource) : []

  return <div className="page openemr-page">
    <section className="page-heading split-heading">
      <div><div className="eyebrow">Named EHR integration</div><h1>Send to OpenEMR</h1><p>Authorize a clinic, select the correct chart, preview every proposed write, and import a patient-controlled intake packet with a durable receipt.</p></div>
      <div className={`openemr-mode ${demoMode ? 'demo' : 'live'}`}><Database size={18}/><span><strong>{config?.configured ? 'OpenEMR adapter configured' : 'Synthetic adapter mode'}</strong><small>{config?.configured ? config.displayBaseUrl : 'No external chart will be changed'}</small></span></div>
    </section>

    <section className="openemr-flow card">
      <div className="openemr-step"><span>1</span><div><strong>Inspect server</strong><small>Read the capability statement and SMART configuration.</small></div></div>
      <div className="openemr-step"><span>2</span><div><strong>Authorize</strong><small>Use OAuth 2.0 Authorization Code with PKCE.</small></div></div>
      <div className="openemr-step"><span>3</span><div><strong>Match patient</strong><small>Select the chart. Vital Passport never guesses.</small></div></div>
      <div className="openemr-step"><span>4</span><div><strong>Preview and send</strong><small>DocumentReference first, discrete data only by choice.</small></div></div>
    </section>

    {error && <div className="openemr-error"><TriangleAlert size={18}/><span>{error}</span></div>}

    <div className="openemr-grid">
      <section className="card openemr-connection-card">
        <div className="card-heading"><div><div className="eyebrow">Connection</div><h2>OpenEMR capability check</h2></div><span className="soft-icon"><Database size={20}/></span></div>
        {!config ? <div className="openemr-loading"><LoaderCircle className="spin" size={18}/> Loading adapter configuration</div> : <>
          <div className="openemr-config-list"><div><span>FHIR base</span><strong>{config.fhirBase || 'Synthetic local adapter'}</strong></div><div><span>Site</span><strong>{config.site}</strong></div><div><span>Authorization</span><strong>{demoMode ? 'Demo connection' : 'SMART OAuth + PKCE'}</strong></div></div>
          <div className="button-row openemr-buttons"><button className="button ghost" onClick={inspect} disabled={Boolean(loading)}>{loading === 'discover' ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>} Inspect capabilities</button>{isConnected ? <button className="button ghost" onClick={disconnect}>Disconnect</button> : <button className="button primary" onClick={connect} disabled={Boolean(loading)}>{loading === 'connect' ? <LoaderCircle className="spin" size={16}/> : <ShieldCheck size={16}/>} {demoMode ? 'Start synthetic connection' : 'Authorize OpenEMR'}</button>}</div>
        </>}
        {discovery && <div className="openemr-discovery"><div><CheckCircle2 size={18}/><span><strong>{discovery.software} {discovery.version}</strong><small>FHIR {discovery.fhirVersion} · {advertisedCreate.length} creatable resource types detected</small></span></div><div className="openemr-resource-tags">{['DocumentReference','Observation','Condition','AllergyIntolerance','Provenance'].map((resource)=><span className={discovery.interactions[resource]?.includes('create') ? 'supported' : 'missing'} key={resource}>{resource}</span>)}</div></div>}
      </section>

      <section className={`card openemr-patient-card ${!isConnected ? 'disabled-card' : ''}`}>
        <div className="card-heading"><div><div className="eyebrow">Patient match</div><h2>Select the destination chart</h2></div><span className="soft-icon"><UserRound size={20}/></span></div>
        <div className="openemr-search-fields"><label><span>Name</span><input value={name} onChange={(event)=>setName(event.target.value)}/></label><label><span>Date of birth</span><input type="date" value={birthDate} onChange={(event)=>setBirthDate(event.target.value)}/></label></div>
        <button className="button primary full" onClick={searchPatients} disabled={!isConnected || Boolean(loading)}>{loading === 'search' ? <LoaderCircle className="spin" size={17}/> : <Search size={17}/>} Search OpenEMR patients</button>
        {patients.length > 0 && <div className="openemr-patient-results">{patients.map((item)=><button className={selectedPatient?.id === item.id ? 'selected' : ''} onClick={()=>setSelectedPatient(item)} key={item.id}><span className="patient-result-avatar">{item.name.split(/\s+/).map((part)=>part[0]).join('').slice(0,2)}</span><span><strong>{item.name}</strong><small>DOB {item.birthDate} · {item.identifier || item.id}</small></span>{selectedPatient?.id === item.id && <CheckCircle2 size={18}/>}</button>)}</div>}
        {isConnected && patients.length === 0 && <p className="openemr-empty">Search by name and birth date. Review every result before selecting a chart.</p>}
      </section>
    </div>

    <section className={`card openemr-preview ${!selectedPatient ? 'disabled-card' : ''}`}>
      <div className="card-heading"><div><div className="eyebrow">Import preview</div><h2>{selectedPatient ? `Proposed handoff to ${selectedPatient.name}` : 'Select a patient to preview the write'}</h2></div><span className="soft-icon"><FileText size={20}/></span></div>
      <div className="openemr-safety-note"><ShieldCheck size={18}/><div><strong>DocumentReference is always first</strong><span>The clinician packet includes medications and visible discrepancies as narrative. Vital Passport never creates MedicationRequest resources or medication orders.</span></div></div>
      <div className="openemr-write-grid">
        <label className="locked"><input type="checkbox" checked readOnly/><span><strong>Patient intake document</strong><small>One source-linked DocumentReference with the full handoff.</small></span></label>
        <label><input type="checkbox" checked={options.includeLabs} onChange={(event)=>setOptions((current)=>({...current,includeLabs:event.target.checked}))}/><span><strong>{packet.labs.length} lab observations</strong><small>Patient-provided, source-labeled, and marked for verification.</small></span></label>
        <label><input type="checkbox" checked={options.includeConditions} onChange={(event)=>setOptions((current)=>({...current,includeConditions:event.target.checked}))}/><span><strong>{packet.patient.conditions.length} conditions</strong><small>Created as unconfirmed problem-list candidates.</small></span></label>
        <label><input type="checkbox" checked={options.includeAllergies} onChange={(event)=>setOptions((current)=>({...current,includeAllergies:event.target.checked}))}/><span><strong>Allergy statements</strong><small>“No known allergies” stays narrative and is not converted into an allergy.</small></span></label>
        <label><input type="checkbox" checked={options.includeProvenance} onChange={(event)=>setOptions((current)=>({...current,includeProvenance:event.target.checked}))}/><span><strong>FHIR Provenance receipt</strong><small>Links the created resources to the patient-controlled handoff.</small></span></label>
      </div>
      <button className="button primary openemr-import-button" onClick={importPacket} disabled={!selectedPatient || Boolean(loading)}>{loading === 'import' ? <><LoaderCircle className="spin" size={17}/> Sending to OpenEMR</> : <>Send reviewed intake <ArrowRight size={17}/></>}</button>
    </section>

    {receipt && <section className={`card openemr-receipt ${receipt.status}`}>
      <div className="openemr-receipt-heading">{receipt.status === 'success' ? <CheckCircle2 size={24}/> : <TriangleAlert size={24}/>}<div><div className="eyebrow">Import receipt</div><h2>{receipt.status === 'success' ? 'OpenEMR handoff completed' : receipt.status === 'partial' ? 'OpenEMR handoff partially completed' : 'OpenEMR handoff failed'}</h2><p>{formatDate(receipt.importedAt)} · Patient {receipt.patientId} · {receipt.openEmr.software} {receipt.openEmr.version}</p></div></div>
      <div className="openemr-receipt-resources">{receipt.resources.map((item)=><div key={`${item.resourceType}-${item.id}`}><span>{item.resourceType}</span><strong>{item.id || 'Created'}</strong></div>)}</div>
      {receipt.warnings.map((warning)=><div className="openemr-receipt-warning" key={warning}><TriangleAlert size={14}/><span>{warning}</span></div>)}
      {receipt.failures.map((failure)=><div className="openemr-receipt-failure" key={`${failure.resourceType}-${failure.error}`}><strong>{failure.resourceType}</strong><span>{failure.error}</span></div>)}
    </section>}

    <div className="openemr-footer"><Link to="/transfer">Back to transfer center</Link><a href="https://github.com/openemr/openemr/blob/master/Documentation/api/README.md" target="_blank" rel="noreferrer">OpenEMR API documentation <ExternalLink size={13}/></a></div>
  </div>
}
