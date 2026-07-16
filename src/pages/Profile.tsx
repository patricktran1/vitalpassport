import { Check, CircleUserRound, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePatientProfile } from '../context/PatientProfileContext'
import { useWorkspace } from '../context/WorkspaceContext'
import type { PatientProfile } from '../lib/patientProfile'

function linesToList(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
}

export function Profile() {
  const { profile, updateProfile, age, initials } = usePatientProfile()
  const workspace = useWorkspace()
  const [draft, setDraft] = useState<PatientProfile>(profile)
  const [saved, setSaved] = useState(false)

  useEffect(() => setDraft(profile), [profile])

  const save = () => {
    updateProfile(draft)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return <div className="page profile-page">
    <section className="page-heading split-heading">
      <div><div className="eyebrow">Patient identity</div><h1>My profile</h1><p>This information labels your Passport and clinician brief. It is separate from names printed on uploaded source documents, which are checked independently.</p></div>
      <div className="profile-avatar-large">{initials}</div>
    </section>

    {workspace.isDemo&&<div className="profile-demo-note"><ShieldCheck size={18}/><span>You are editing the synthetic demo profile. Resetting the demo restores the original fictional identity.</span></div>}

    <section className="card profile-editor">
      <div className="profile-editor-heading"><CircleUserRound size={22}/><div><strong>Passport identity</strong><span>{age !== null ? `${age} years old` : 'Add a date of birth to calculate age'}</span></div></div>
      <div className="profile-form-grid">
        <label><span>Full name</span><input value={draft.name} onChange={(event)=>setDraft((current)=>({...current,name:event.target.value}))} placeholder="Your full name" autoComplete="name"/></label>
        <label><span>Date of birth</span><input type="date" value={draft.dob} onChange={(event)=>setDraft((current)=>({...current,dob:event.target.value}))}/></label>
        <label><span>Pronouns</span><input value={draft.pronouns} onChange={(event)=>setDraft((current)=>({...current,pronouns:event.target.value}))} placeholder="Optional"/></label>
      </div>
      <label className="profile-list-field"><span>Conditions</span><textarea value={draft.conditions.join('\n')} onChange={(event)=>setDraft((current)=>({...current,conditions:linesToList(event.target.value)}))} rows={4} placeholder="One condition per line"/></label>
      <label className="profile-list-field"><span>Allergies</span><textarea value={draft.allergies.join('\n')} onChange={(event)=>setDraft((current)=>({...current,allergies:linesToList(event.target.value)}))} rows={4} placeholder="One allergy per line, or leave blank"/></label>
      <div className="profile-actions"><button className="button primary" onClick={save}>{saved?<><Check size={17}/> Saved</>:<>Save profile</>}</button><span>Changes remain local until cloud sync is active.</span></div>
    </section>
  </div>
}
