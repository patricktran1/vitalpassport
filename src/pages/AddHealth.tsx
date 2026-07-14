import { Camera, FileText, HelpCircle, Mic, Pill, Plus, Sparkles, Stethoscope, TestTube2, UploadCloud, WandSparkles, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useVital } from '../context/VitalContext'
import type { HealthItemType } from '../types'

const options: Array<{type: HealthItemType; label: string; help: string; icon: typeof Camera}> = [
  { type:'photo', label:'Take or upload a photo', help:'Concern, medication, device, or paperwork', icon:Camera },
  { type:'document', label:'Upload a document', help:'Visit summary, imaging report, discharge instructions, or letter', icon:FileText },
  { type:'lab', label:'Add lab results', help:'Upload or photograph a laboratory report', icon:TestTube2 },
  { type:'medication', label:'Add a medication', help:'Photograph the bottle or enter it manually', icon:Pill },
  { type:'voice', label:'Record a voice note', help:'Describe what happened in your own words', icon:Mic },
  { type:'symptom', label:'Log a symptom', help:'Track timing, severity, triggers, and changes', icon:Stethoscope },
  { type:'question', label:'Add a doctor question', help:'Remember what matters before the visit', icon:HelpCircle },
]

const mockExtraction = {
  photo: { title:'Health photo', summary:'Image added to the active concern timeline.', fields:[['Captured','Today'],['Related concern','Dizziness and fatigue'],['Status','Needs patient context']] },
  document: { title:'After-visit summary', summary:'Visit details, medication instructions, and follow-up plan extracted.', fields:[['Visit date','July 2, 2026'],['Facility','Bayview Urgent Care'],['Follow-up','Primary care in 1–2 weeks']] },
  lab: { title:'Laboratory report', summary:'Results, reference ranges, and abnormal flags extracted.', fields:[['Hemoglobin','10.8 g/dL · Low'],['Glucose','168 mg/dL · High'],['Creatinine','0.9 mg/dL · Normal']] },
  medication: { title:'Medication bottle', summary:'Medication name, strength, and directions extracted.', fields:[['Medication','Metoprolol succinate ER'],['Strength','50 mg'],['Directions','One tablet every morning']] },
  voice: { title:'Symptom voice note', summary:'Your description was converted into a structured symptom update.', fields:[['Symptom','Lightheadedness'],['Pattern','Mostly mornings'],['Duration','About three weeks']] },
  symptom: { title:'Symptom update', summary:'A new symptom event was added to your health timeline.', fields:[['Severity','Moderate'],['Timing','Intermittent'],['Status','Ongoing']] },
  question: { title:'Question for Dr. Kim', summary:'Your question was added to the clinician brief.', fields:[['Topic','Medication'],['Priority','High'],['Status','Ready for visit']] },
}

const inputCopy: Record<HealthItemType,{placeholder:string;sample:string;sampleLabel:string}> = {
  photo: { placeholder:'Add context for the photo, such as where the concern is located and when it started…', sample:'Photo of medication bottle taken today. This is the dose I am currently taking.', sampleLabel:'Use demo medication photo' },
  document: { placeholder:'Paste visit instructions or notes here, or upload the original document above…', sample:'Bayview Urgent Care, July 2, 2026. Follow up with primary care in 1–2 weeks. Metoprolol 25 mg twice daily.', sampleLabel:'Use demo visit summary' },
  lab: { placeholder:'Paste laboratory results here, or upload a report above…', sample:'Hemoglobin 10.8 g/dL low. Glucose 168 mg/dL high. Creatinine 0.9 mg/dL normal.', sampleLabel:'Use demo lab report' },
  medication: { placeholder:'Enter the medication name, dose, and how you take it…', sample:'Metoprolol succinate ER 50 mg. Take one tablet by mouth every morning.', sampleLabel:'Use demo bottle label' },
  voice: { placeholder:'Describe the symptom in your own words. Include when it started, what it feels like, and what makes it better or worse…', sample:'I have felt lightheaded most mornings for about three weeks. It is worse when I get out of bed and sometimes improves after breakfast.', sampleLabel:'Use demo voice note' },
  symptom: { placeholder:'What happened? Include timing, severity, triggers, and whether it is improving or worsening…', sample:'Moderate dizziness when standing, intermittent, ongoing for three weeks. No fainting.', sampleLabel:'Use demo symptom update' },
  question: { placeholder:'What do you want to make sure your doctor answers?…', sample:'Could the medication change be contributing to the dizziness?', sampleLabel:'Use demo doctor question' },
}

const filePreferred: HealthItemType[] = ['photo','document','lab','medication']

export function AddHealth() {
  const [selected, setSelected] = useState<HealthItemType | null>(null)
  const [processing, setProcessing] = useState(false)
  const [complete, setComplete] = useState(false)
  const [fileName, setFileName] = useState('')
  const [textValue,setTextValue]=useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { addUpload } = useVital()

  const clearWorkspace=()=>{setSelected(null);setComplete(false);setFileName('');setTextValue('')}

  const processItem = () => {
    if (!selected || (!fileName && !textValue.trim())) return
    setProcessing(true)
    setTimeout(() => { setProcessing(false); setComplete(true) }, 1400)
  }

  const saveItem = () => {
    if (!selected) return
    const extraction = mockExtraction[selected]
    addUpload({ id:`upload-${Date.now()}`, name:extraction.title, type:selected, date:'Today', status:'ready', summary:extraction.summary })
    clearWorkspace()
  }

  return <div className="page">
    <section className="page-heading"><div className="eyebrow">Capture anything</div><h1>Add health information</h1><p>Bring in the scraps. Vital Passport will identify what they are, connect them to the health story, and flag anything that needs confirmation.</p></section>

    {!selected && <div className="capture-grid">{options.map(({type,label,help,icon:Icon}) => <button className="capture-card" key={type} onClick={() => setSelected(type)}><span className="capture-icon"><Icon size={23}/></span><span><strong>{label}</strong><small>{help}</small></span><Plus size={19}/></button>)}</div>}

    {selected && <section className="card capture-workspace">
      <div className="card-heading"><div><div className="eyebrow">New item</div><h2>{options.find(o=>o.type===selected)?.label}</h2></div><button className="icon-button" onClick={clearWorkspace}><X size={20}/></button></div>

      {!processing && !complete && <>
        {filePreferred.includes(selected)&&<>
          <button className="drop-zone" onClick={()=>fileRef.current?.click()}><UploadCloud size={34}/><strong>{fileName || 'Choose a file or photo'}</strong><span>PDF, JPG, PNG, HEIC, or a camera image</span></button>
          <input ref={fileRef} type="file" hidden onChange={(e)=>setFileName(e.target.files?.[0]?.name || '')}/>
          <div className="or-divider"><span>or add the information manually</span></div>
        </>}
        <textarea className="large-input" value={textValue} onChange={e=>setTextValue(e.target.value)} placeholder={inputCopy[selected].placeholder} rows={5}/>
        <div className="sample-input-row"><button className="sample-button" onClick={()=>{setTextValue(inputCopy[selected].sample);setFileName('')}}><WandSparkles size={15}/>{inputCopy[selected].sampleLabel}</button><span>Loads synthetic data for the hackathon demo.</span></div>
        <button className="button primary full" disabled={!fileName&&!textValue.trim()} onClick={processItem}><Sparkles size={17}/> Organize this information</button>
      </>}

      {processing && <div className="processing-state"><div className="processing-orbit"><Sparkles size={24}/></div><h3>Reading, comparing, and organizing</h3><p>Identifying dates, medications, results, instructions, related concerns, and anything that conflicts with the existing story.</p><div className="processing-lines"><span/><span/><span/></div></div>}

      {complete && <div className="extraction-result"><div className="success-mark"><TestTube2 size={22}/></div><div className="eyebrow">Ready for review</div><h2>{mockExtraction[selected].title}</h2><p>{mockExtraction[selected].summary}</p><div className="extracted-fields">{mockExtraction[selected].fields.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="confidence-bar"><span><Sparkles size={15}/> High-confidence extraction</span><strong>94%</strong></div><div className="button-row"><button className="button ghost" onClick={()=>setComplete(false)}>Correct details</button><button className="button primary" onClick={saveItem}>Confirm and add</button></div></div>}
    </section>}

    <div className="trust-strip"><UploadCloud size={18}/><span>Uploads are organized for this demo in your browser. Production storage and sharing should use encrypted, access-controlled infrastructure.</span></div>
  </div>
}
