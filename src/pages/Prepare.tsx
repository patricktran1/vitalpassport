import { ArrowLeft, ArrowRight, Check, Info, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useVital } from '../context/VitalContext'

const questions = [
  { key:'timing' as const, title:'Did the dizziness begin before or after the metoprolol dose changed?', reason:'The timing helps your doctor understand whether the two events may be related.', options:['Before the dose changed','After the dose changed','Around the same time','I’m not sure'] },
  { key:'positional' as const, title:'Does the dizziness happen when you stand up?', reason:'This pattern is important context for your clinician and your home blood-pressure readings.', options:['Yes, often','Sometimes','No','I’m not sure'] },
  { key:'dose' as const, title:'Which metoprolol dose are you taking now?', reason:'Your bottle photo and urgent care summary list different instructions.', options:['25 mg twice daily','50 mg once daily','I take it differently','I’m not sure'] },
  { key:'priorities' as const, title:'What are the most important things you want Dr. Kim to answer?', reason:'Your priorities will appear at the top of the clinician brief.', options:[] },
]

export function Prepare() {
  const [step,setStep]=useState(0)
  const { answers,setAnswer }=useVital()
  const q=questions[step]
  const current=answers[q.key]
  const done=step===questions.length-1 && Boolean(current)
  return <div className="page prepare-page">
    <section className="page-heading compact"><div className="eyebrow">Visit preparation agent</div><h1>Let’s close the important gaps.</h1><p>I reviewed Maria’s records and found four details that would make the clinical story clearer.</p></section>
    <div className="interview-progress"><div><span>Question {step+1} of {questions.length}</span><strong>{Math.round(((step+(current?1:0))/questions.length)*100)}% complete</strong></div><div className="progress-track"><span style={{width:`${((step+(current?1:0))/questions.length)*100}%`}}/></div></div>

    <section className="interview-card">
      <div className="agent-avatar"><Sparkles size={22}/></div>
      <div className="agent-label">Vital Passport</div>
      <h2>{q.title}</h2>
      <div className="why-note"><Info size={16}/><span>{q.reason}</span></div>
      {q.options.length>0 ? <div className="answer-options">{q.options.map(option=><button key={option} className={`answer-option ${current===option?'selected':''}`} onClick={()=>setAnswer(q.key,option)}><span>{option}</span>{current===option&&<Check size={18}/>}</button>)}</div> : <textarea className="large-input priority-input" value={current} onChange={e=>setAnswer(q.key,e.target.value)} placeholder="Example: Could my medication be causing this? Do I need more testing? What should make me seek urgent care?" rows={5}/>} 
      <div className="interview-actions"><button className="button ghost" disabled={step===0} onClick={()=>setStep(s=>s-1)}><ArrowLeft size={17}/> Back</button>{done?<Link to="/brief" className="button primary">View clinician brief <ArrowRight size={17}/></Link>:<button className="button primary" disabled={!current} onClick={()=>setStep(s=>Math.min(questions.length-1,s+1))}>Continue <ArrowRight size={17}/></button>}</div>
    </section>
    <p className="safety-copy">Vital Passport organizes information and helps you prepare questions. It does not diagnose conditions or recommend medication changes.</p>
  </div>
}
