import { CalendarDays, FileText, MapPin, Pill, Stethoscope, TestTube2 } from 'lucide-react'
import { useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import { sources, timeline } from '../data/demo'
import { useVital } from '../context/VitalContext'

const filters = ['all','symptoms','medications','visits','results','documents'] as const
const iconMap = { symptoms:Stethoscope, medications:Pill, visits:MapPin, results:TestTube2, documents:FileText }

export function Timeline() {
  const [filter,setFilter] = useState<typeof filters[number]>('all')
  const { openSource } = useVital()
  const shown = filter === 'all' ? timeline : timeline.filter(e=>e.category===filter)
  return <div className="page">
    <section className="page-heading"><div className="eyebrow">One connected story</div><h1>Health timeline</h1><p>Visits, symptoms, medications, results, and patient-reported updates in chronological order.</p></section>
    <div className="filter-row">{filters.map(f=><button key={f} className={`filter-chip ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f==='all'?'Everything':f[0].toUpperCase()+f.slice(1)}</button>)}</div>
    <section className="timeline-list">
      {shown.map((event,index)=>{const Icon=iconMap[event.category]; const source=sources.find(s=>s.id===event.sourceId); return <article className="timeline-entry" key={event.id}>
        <div className="timeline-date"><strong>{event.displayDate}</strong><span>{event.date.slice(0,4)}</span></div>
        <div className="timeline-spine"><span className={`event-icon ${event.category}`}><Icon size={18}/></span>{index<shown.length-1&&<span className="spine-line"/>}</div>
        <div className="timeline-content"><div className="timeline-title-row"><h2>{event.title}</h2><StatusBadge type={event.sourceType} label={event.sourceLabel}/></div><p>{event.summary}</p>{source&&<button className="source-link" onClick={()=>openSource(source)}><FileText size={14}/> View source</button>}</div>
      </article>})}
    </section>
    <div className="timeline-footer"><CalendarDays size={18}/><span>Upcoming events appear alongside past records so the next step never disappears.</span></div>
  </div>
}
