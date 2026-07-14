import { Camera, CheckCircle2, FileText, HelpCircle, Mic, Pill, Plus, ShieldCheck, Sparkles, Stethoscope, TestTube2, TriangleAlert, UploadCloud, WandSparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useVital } from '../context/VitalContext'
import { ExtractionError, extractHealthItem, imageFileToDataUrl } from '../lib/extraction'
import type { HealthExtraction, HealthItemType } from '../types'

const options: Array<{type: HealthItemType; label: string; help: string; icon: typeof Camera}> = [
  { type:'photo', label:'Take or upload a photo', help:'Concern, medication, device, or paperwork', icon:Camera },
  { type:'document', label:'Upload a document', help:'Visit summary, imaging report, discharge instructions, or letter', icon:FileText },
  { type:'lab', label:'Add lab results', help:'Upload or photograph a laboratory report', icon:TestTube2 },
  { type:'medication', label:'Add a medication', help:'Photograph the bottle or enter it manually', icon:Pill },
  { type:'voice', label:'Record a voice note', help:'Describe what happened in your own words', icon:Mic },
  { type:'symptom', label:'Log a symptom', help:'Track timing, severity, triggers, and changes', icon:Stethoscope },
  { type:'question', label:'Add a doctor question', help:'Remember what matters before the visit', icon:HelpCircle },
]

const inputCopy: Record<HealthItemType,{placeholder:string;sample:string;sampleLabel:string}> = {
  photo: { placeholder:'Add context for the photo, such as where the concern is located and when it started…', sample:'Photo of medication bottle taken today. This is the dose I am currently taking.', sampleLabel:'Use demo medication photo' },
  document: { placeholder:'Paste visit instructions or notes here, or photograph the original document above…', sample:'Bayview Urgent Care, July 2, 2026. Follow up with primary care in 1–2 weeks. Metoprolol 25 mg twice daily.', sampleLabel:'Use demo visit summary' },
  lab: { placeholder:'Paste laboratory results here, or photograph the report above…', sample:'Hemoglobin 10.8 g/dL low. Glucose 168 mg/dL high. Creatinine 0.9 mg/dL normal.', sampleLabel:'Use demo lab report' },
  medication: { placeholder:'Enter the medication name, dose, and how you take it…', sample:'Metoprolol succinate ER 50 mg. Take one tablet by mouth every morning.', sampleLabel:'Use demo bottle label' },
  voice: { placeholder:'Describe the symptom in your own words. Include when it started, what it feels like, and what makes it better or worse…', sample:'I have felt lightheaded most mornings for about three weeks. It is worse when I get out of bed and sometimes improves after breakfast.', sampleLabel:'Use demo voice note' },
  symptom: { placeholder:'What happened? Include timing, severity, triggers, and whether it is improving or worsening…', sample:'Moderate dizziness when standing, intermittent, ongoing for three weeks. No fainting.', sampleLabel:'Use demo symptom update' },
  question: { placeholder:'What do you want to make sure your doctor answers?…', sample:'Could the medication change be contributing to the dizziness?', sampleLabel:'Use demo doctor question' },
}

const demoExtraction: Record<HealthItemType, HealthExtraction> = {
  photo: { document_type:'health_photo', title:'Medication bottle photograph', summary:'A medication bottle image was added for patient verification.', event_date:'Today', facility:'', medications:[{name:'Metoprolol succinate ER',strength:'50 mg',directions:'Take one tablet every morning',prescriber:''}], lab_results:[], diagnoses:[], instructions:[], symptoms:[], follow_up:'', evidence:[{field:'Medication directions',value:'50 mg once daily',quote:'METOPROLOL SUCC ER 50 MG — TAKE 1 TABLET EVERY MORNING',confidence:.97}], warnings:['Compare against the current medication list.'], requires_confirmation:true, confidence:.94, mode:'demo', model:'Synthetic demo' },
  document: { document_type:'after_visit_summary', title:'Bayview Urgent Care summary', summary:'Urgent care visit details, medication instructions, and follow-up timing were extracted.', event_date:'July 2, 2026', facility:'Bayview Urgent Care', medications:[{name:'Metoprolol',strength:'25 mg',directions:'Take twice daily',prescriber:''}], lab_results:[], diagnoses:[], instructions:['Follow up with primary care in 1–2 weeks.'], symptoms:[], follow_up:'Primary care in 1–2 weeks', evidence:[{field:'Medication directions',value:'25 mg twice daily',quote:'Metoprolol 25 mg twice daily',confidence:.96}], warnings:['This dose conflicts with the photographed medication bottle.'], requires_confirmation:true, confidence:.93, mode:'demo', model:'Synthetic demo' },
  lab: { document_type:'lab_report', title:'Laboratory report', summary:'Three laboratory values were extracted with abnormal flags preserved.', event_date:'July 2, 2026', facility:'Bayview Medical Laboratory', medications:[], lab_results:[{test:'Hemoglobin',value:'10.8',unit:'g/dL',reference_range:'12.0–15.5',abnormal_flag:'Low'},{test:'Glucose',value:'168',unit:'mg/dL',reference_range:'70–99',abnormal_flag:'High'},{test:'Creatinine',value:'0.9',unit:'mg/dL',reference_range:'0.6–1.2',abnormal_flag:'Normal'}], diagnoses:[], instructions:[], symptoms:[], follow_up:'', evidence:[{field:'Hemoglobin',value:'10.8 g/dL',quote:'Hemoglobin 10.8 L',confidence:.98},{field:'Glucose',value:'168 mg/dL',quote:'Glucose 168 H',confidence:.98}], warnings:[], requires_confirmation:false, confidence:.97, mode:'demo', model:'Synthetic demo' },
  medication: { document_type:'medication_bottle', title:'Metoprolol bottle label', summary:'Medication name, strength, and directions were extracted from the bottle label.', event_date:'Today', facility:'', medications:[{name:'Metoprolol succinate ER',strength:'50 mg',directions:'Take one tablet by mouth every morning',prescriber:''}], lab_results:[], diagnoses:[], instructions:[], symptoms:[], follow_up:'', evidence:[{field:'Medication',value:'Metoprolol succinate ER 50 mg',quote:'METOPROLOL SUCC ER 50 MG',confidence:.99},{field:'Directions',value:'One tablet every morning',quote:'TAKE 1 TABLET BY MOUTH EVERY MORNING',confidence:.98}], warnings:['Confirm that this is the medication currently being taken.'], requires_confirmation:true, confidence:.98, mode:'demo', model:'Synthetic demo' },
  voice: { document_type:'symptom_note', title:'Lightheadedness voice note', summary:'The patient described morning lightheadedness lasting approximately three weeks.', event_date:'Today', facility:'', medications:[], lab_results:[], diagnoses:[], instructions:[], symptoms:['Lightheadedness most mornings for about three weeks','Worse when getting out of bed','Sometimes improves after breakfast'], follow_up:'', evidence:[{field:'Symptom pattern',value:'Mostly mornings',quote:'lightheaded most mornings for about three weeks',confidence:.96}], warnings:[], requires_confirmation:false, confidence:.93, mode:'demo', model:'Synthetic demo' },
  symptom: { document_type:'symptom_note', title:'Dizziness symptom update', summary:'Moderate intermittent dizziness when standing was logged as ongoing.', event_date:'Today', facility:'', medications:[], lab_results:[], diagnoses:[], instructions:[], symptoms:['Moderate dizziness when standing','Intermittent for three weeks','No fainting'], follow_up:'', evidence:[{field:'Trigger',value:'Standing',quote:'dizziness when standing',confidence:.98}], warnings:[], requires_confirmation:false, confidence:.96, mode:'demo', model:'Synthetic demo' },
  question: { document_type:'question', title:'Question for Dr. Kim', summary:'A medication-related question was added to the visit priorities.', event_date:'Today', facility:'', medications:[], lab_results:[], diagnoses:[], instructions:[], symptoms:[], follow_up:'', evidence:[{field:'Patient priority',value:'Could the medication change be contributing to the dizziness?',quote:'Could the medication change be contributing to the dizziness?',confidence:1}], warnings:[], requires_confirmation:false, confidence:1, mode:'demo', model:'Synthetic demo' },
}

const filePreferred: HealthItemType[] = ['photo','document','lab','medication']

function extractionRows(extraction: HealthExtraction) {
  const rows: Array<[string,string]> = []
  if (extraction.event_date) rows.push(['Date', extraction.event_date])
  if (extraction.facility) rows.push(['Facility', extraction.facility])
  extraction.medications.forEach((medication) => rows.push(['Medication', [medication.name, medication.strength, medication.directions].filter(Boolean).join(' · ')]))
  extraction.lab_results.forEach((lab) => rows.push([lab.test || 'Lab result', [lab.value, lab.unit, lab.abnormal_flag].filter(Boolean).join(' · ')]))
  extraction.symptoms.forEach((symptom) => rows.push(['Symptom', symptom]))
  extraction.diagnoses.forEach((diagnosis) => rows.push(['Documented diagnosis', diagnosis]))
  extraction.instructions.forEach((instruction) => rows.push(['Instruction', instruction]))
  if (extraction.follow_up) rows.push(['Follow-up', extraction.follow_up])
  return rows.slice(0, 14)
}

export function AddHealth() {
  const [selected, setSelected] = useState<HealthItemType | null>(null)
  const [processing, setProcessing] = useState(false)
  const [extraction, setExtraction] = useState<HealthExtraction | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [textValue,setTextValue]=useState('')
  const [error,setError]=useState('')
  const [setupNeeded,setSetupNeeded]=useState(false)
  const [demoLoaded,setDemoLoaded]=useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { addUpload } = useVital()

  const clearWorkspace=()=>{setSelected(null);setExtraction(null);setSelectedFile(null);setTextValue('');setError('');setSetupNeeded(false);setDemoLoaded(false)}

  const processItem = async () => {
    if (!selected || (!selectedFile && !textValue.trim())) return
    setProcessing(true)
    setError('')
    setSetupNeeded(false)
    try {
      const imageDataUrl = selectedFile ? await imageFileToDataUrl(selectedFile) : undefined
      const result = await extractHealthItem({
        kind:selected,
        text:textValue.trim() || undefined,
        imageDataUrl,
        fileName:selectedFile?.name,
      })
      setExtraction(result)
    } catch (caught) {
      const extractionError = caught instanceof ExtractionError ? caught : new ExtractionError('Vital Passport could not organize this item.')
      if (extractionError.code === 'MISSING_API_KEY' && demoLoaded) {
        setExtraction(demoExtraction[selected])
        setSetupNeeded(true)
      } else {
        setError(extractionError.message)
        setSetupNeeded(extractionError.code === 'MISSING_API_KEY')
      }
    } finally {
      setProcessing(false)
    }
  }

  const saveItem = () => {
    if (!selected || !extraction) return
    addUpload({ id:`upload-${Date.now()}`, name:extraction.title, type:selected, date:'Today', status:'ready', summary:extraction.summary, extraction })
    clearWorkspace()
  }

  return <div className="page">
    <section className="page-heading"><div className="eyebrow">Nebius + Meta Llama</div><h1>Add health information</h1><p>Photograph a medication label, lab report, or visit summary. Vital Passport extracts only source-supported facts, preserves uncertainty, and asks you to confirm what matters.</p></section>

    {!selected && <div className="capture-grid">{options.map(({type,label,help,icon:Icon}) => <button className="capture-card" key={type} onClick={() => setSelected(type)}><span className="capture-icon"><Icon size={23}/></span><span><strong>{label}</strong><small>{help}</small></span><Plus size={19}/></button>)}</div>}

    {selected && <section className="card capture-workspace">
      <div className="card-heading"><div><div className="eyebrow">New item</div><h2>{options.find(o=>o.type===selected)?.label}</h2></div><button className="icon-button" onClick={clearWorkspace}><X size={20}/></button></div>

      {!processing && !extraction && <>
        {filePreferred.includes(selected)&&<>
          <button className={`drop-zone ${selectedFile?'has-file':''}`} onClick={()=>fileRef.current?.click()}><UploadCloud size={34}/><strong>{selectedFile?.name || 'Choose a photo'}</strong><span>JPG, PNG, or WebP · images are resized before analysis</span></button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,.pdf" hidden onChange={(e)=>{setSelectedFile(e.target.files?.[0] || null);setError('');setDemoLoaded(false)}}/>
          <div className="or-divider"><span>or add the information manually</span></div>
        </>}
        <textarea className="large-input" value={textValue} onChange={e=>{setTextValue(e.target.value);setDemoLoaded(false)}} placeholder={inputCopy[selected].placeholder} rows={5}/>
        <div className="sample-input-row"><button className="sample-button" onClick={()=>{setTextValue(inputCopy[selected].sample);setSelectedFile(null);setDemoLoaded(true);setError('')}}><WandSparkles size={15}/>{inputCopy[selected].sampleLabel}</button><span>Loads synthetic data. With no API key, it safely falls back to the demo result.</span></div>
        {error&&<div className="extraction-error"><TriangleAlert size={18}/><div><strong>Extraction could not run</strong><span>{error}</span>{setupNeeded&&<small>Add <code>NEBIUS_API_KEY</code> in Vercel, then redeploy.</small>}</div></div>}
        <button className="button primary full" disabled={!selectedFile&&!textValue.trim()} onClick={processItem}><Sparkles size={17}/> Extract with Llama</button>
      </>}

      {processing && <div className="processing-state"><div className="processing-orbit"><Sparkles size={24}/></div><h3>Reading the source with Llama</h3><p>Extracting dates, medications, results, instructions, exact evidence, and anything that requires patient confirmation.</p><div className="processing-lines"><span/><span/><span/></div></div>}

      {extraction && <div className="extraction-result live-result">
        <div className={`success-mark ${extraction.requires_confirmation?'attention':''}`}>{extraction.requires_confirmation?<TriangleAlert size={22}/>:<CheckCircle2 size={22}/>}</div>
        <div className="extraction-mode-row"><span className={`mode-pill ${extraction.mode==='demo'?'demo':''}`}><Sparkles size={13}/>{extraction.mode==='demo'?'Synthetic fallback':'Live Nebius extraction'}</span><span>{Math.round(extraction.confidence*100)}% overall confidence</span></div>
        {setupNeeded&&<div className="setup-banner"><ShieldCheck size={17}/><span>This preview used synthetic fallback data. Add the Nebius key in Vercel to activate live extraction.</span></div>}
        <div className="eyebrow">Patient review required</div><h2>{extraction.title}</h2><p>{extraction.summary}</p>
        <div className="extracted-fields">{extractionRows(extraction).map(([label,value],index)=><div key={`${label}-${index}`}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {extraction.evidence.length>0&&<div className="evidence-panel"><div className="evidence-heading"><FileText size={16}/><strong>Source evidence</strong><span>Click-through provenance for the future health record</span></div>{extraction.evidence.slice(0,6).map((item,index)=><div className="evidence-row" key={`${item.field}-${index}`}><div><span>{item.field}</span><strong>{item.value}</strong><blockquote>“{item.quote}”</blockquote></div><small>{Math.round(item.confidence*100)}%</small></div>)}</div>}
        {extraction.warnings.length>0&&<div className="warning-list">{extraction.warnings.map((warning)=><div key={warning}><TriangleAlert size={15}/><span>{warning}</span></div>)}</div>}
        <div className={`confirmation-state ${extraction.requires_confirmation?'attention':''}`}><ShieldCheck size={18}/><div><strong>{extraction.requires_confirmation?'Confirm before adding':'Ready to add'}</strong><span>{extraction.requires_confirmation?'The AI found information that is uncertain, conflicting, or clinically important to verify.':'The extracted facts are source-supported. You remain in control before they enter the health story.'}</span></div></div>
        <div className="button-row"><button className="button ghost" onClick={()=>setExtraction(null)}>Change input</button><button className="button primary" onClick={saveItem}>Confirm and add</button></div>
      </div>}
    </section>}

    <div className="trust-strip"><ShieldCheck size={18}/><span>The browser sends the selected image or text to a same-origin Vercel function, which calls Nebius. The API key never enters the browser or GitHub.</span></div>
  </div>
}
