import { CalendarDays, FileText, MapPin, Pill, Stethoscope, TestTube2 } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import { useVital } from '../context/VitalContext'
import { genericTimelineReplacement } from '../lib/extractionRouting'

const filters = ['all','symptoms','medications','visits','results','documents'] as const
const iconMap = { symptoms:Stethoscope, medications:Pill, visits:MapPin, results:TestTube2, documents:FileText }

export function Timeline() {
  const [filter,setFilter] = useState<typeof filters[number]>('all')
  const { openSource, sources, timelineEvents } = useVital()
  const shown = filter === 'all' ? timelineEvents : timelineEvents.filter(e=>e.category===filter)
  return <div className="page">
    <section className="page-heading"><div className="eyebrow">One connected story</div><h1>Health timeline</h1><p>Every confirmed extraction becomes a dated event while retaining its original source and verification status.</p></section>
    <div className="filter-row">{filters.map(f=><button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'Everything':f[0].toUpperCase()+f.slice(1)}</button>)}</div>
    <section className="timeline-list">
      {shown.map((event,index)=>{const Icon=iconMap[event.category]; const source=sources.find(s=>s.id===event.sourceId); const display=genericTimelineReplacement(event.category,source?.details||[],event.title,event.summary); return <article className="timeline-entry" key={event.id}>
        <div className="timeline-date"><strong>{event.displayDate}</strong><span>{event.date.slice(0,4)}</span></div>
        <div className="timeline-spine"><span className={`event-icon ${event.category}`}><Icon size={18}/></span>{index<shown.length-1&&<span className="spine-line"/>}</div>
        <div className="timeline-content"><div className="timeline-title-row"><h2>{display.title}</h2><StatusBadge type={event.sourceType} label={event.sourceLabel}/></div><p>{display.summary}</p>{source&&<button className="source-link" onClick={()=>openSource(source)}><FileText size={14}/> View original source</button>}</div>
      </article>})}
    </section>
    <div className="timeline-footer"><CalendarDays size={18}/><span>New uploads and reconciliation decisions appear here automatically. Superseded facts remain traceable through their original sources.</span></div>
  </div>
}
