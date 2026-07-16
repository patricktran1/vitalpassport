import { Camera, Check, CircleUserRound, Mail, MapPin, Phone, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { usePatientProfile } from '../context/PatientProfileContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { patientInitials, prepareProfilePhoto, type PatientProfile } from '../lib/patientProfile'

function linesToList(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean)
}

export function Profile() {
  const { profile, updateProfile, age } = usePatientProfile()
  const workspace = useWorkspace()
  const auth = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<PatientProfile>(profile)
  const [saved, setSaved] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setDraft(profile), [profile])
  useEffect(() => {
    if (!auth.user?.email) return
    setDraft((current) => current.email ? current : { ...current, email: auth.user?.email || '' })
  }, [auth.user?.email])

  const save = () => {
    updateProfile(draft)
    setSaved(true)
    setError('')
    window.setTimeout(() => setSaved(false), 1800)
  }

  const changePhoto = async (file: File | null) => {
    if (!file) return
    setPhotoBusy(true)
    setError('')
    try {
      const photoDataUrl = await prepareProfilePhoto(file)
      setDraft((current) => ({ ...current, photoDataUrl }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The photograph could not be prepared.')
    } finally {
      setPhotoBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const initials = patientInitials(draft.name)

  return <div className="page profile-page">
    <section className="page-heading split-heading profile-heading">
      <div><div className="eyebrow">Patient identity and contact</div><h1>My profile</h1><p>This is the identity attached to your Passport, clinician brief, and transfer packets. Names printed on uploaded records are still checked independently.</p></div>
      <div className="profile-avatar-large">{draft.photoDataUrl ? <img src={draft.photoDataUrl} alt="Patient profile"/> : initials}</div>
    </section>

    {workspace.isDemo&&<div className="profile-demo-note"><ShieldCheck size={18}/><span>You are editing the synthetic demo profile. Resetting the demo restores the original fictional identity.</span></div>}

    <section className="card profile-editor">
      <div className="profile-photo-panel">
        <div className="profile-photo-preview">{draft.photoDataUrl ? <img src={draft.photoDataUrl} alt="Patient profile preview"/> : <span>{initials}</span>}</div>
        <div><strong>Profile photograph</strong><p>A small square copy is prepared in your browser before it is stored with the profile.</p><div className="profile-photo-actions"><button className="button ghost" type="button" onClick={()=>fileRef.current?.click()} disabled={photoBusy}><Camera size={16}/>{photoBusy?'Preparing…':draft.photoDataUrl?'Change photo':'Add photo'}</button>{draft.photoDataUrl&&<button className="button ghost danger-button" type="button" onClick={()=>setDraft((current)=>({...current,photoDataUrl:''}))}><Trash2 size={16}/>Remove</button>}</div></div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event)=>void changePhoto(event.target.files?.[0]||null)}/>
      </div>

      <div className="profile-section-heading"><CircleUserRound size={20}/><div><strong>Identity</strong><span>{age !== null ? `${age} years old` : 'Add a date of birth to calculate age'}</span></div></div>
      <div className="profile-form-grid identity-grid">
        <label><span>Full name</span><input value={draft.name} onChange={(event)=>setDraft((current)=>({...current,name:event.target.value}))} placeholder="Your full name" autoComplete="name"/></label>
        <label><span>Date of birth</span><input type="date" value={draft.dob} onChange={(event)=>setDraft((current)=>({...current,dob:event.target.value}))}/></label>
        <label><span>Pronouns</span><input value={draft.pronouns} onChange={(event)=>setDraft((current)=>({...current,pronouns:event.target.value}))} placeholder="Optional"/></label>
      </div>

      <div className="profile-section-heading"><Phone size={20}/><div><strong>Contact information</strong><span>Editable independently from the email used to sign in</span></div></div>
      <div className="profile-form-grid two-column-grid">
        <label><span>Email address</span><div className="profile-input-with-icon"><Mail size={16}/><input type="email" value={draft.email} onChange={(event)=>setDraft((current)=>({...current,email:event.target.value}))} placeholder="patient@example.com" autoComplete="email"/></div></label>
        <label><span>Phone number</span><div className="profile-input-with-icon"><Phone size={16}/><input type="tel" value={draft.phone} onChange={(event)=>setDraft((current)=>({...current,phone:event.target.value}))} placeholder="(555) 555-0123" autoComplete="tel"/></div></label>
      </div>

      <div className="profile-section-heading"><MapPin size={20}/><div><strong>Mailing address</strong><span>Used only when you choose to include contact information in a handoff</span></div></div>
      <div className="profile-form-grid two-column-grid">
        <label className="wide-field"><span>Address line 1</span><input value={draft.addressLine1} onChange={(event)=>setDraft((current)=>({...current,addressLine1:event.target.value}))} placeholder="Street address" autoComplete="address-line1"/></label>
        <label className="wide-field"><span>Address line 2</span><input value={draft.addressLine2} onChange={(event)=>setDraft((current)=>({...current,addressLine2:event.target.value}))} placeholder="Apartment, suite, unit" autoComplete="address-line2"/></label>
        <label><span>City</span><input value={draft.city} onChange={(event)=>setDraft((current)=>({...current,city:event.target.value}))} autoComplete="address-level2"/></label>
        <label><span>State</span><input value={draft.state} onChange={(event)=>setDraft((current)=>({...current,state:event.target.value}))} autoComplete="address-level1"/></label>
        <label><span>ZIP / postal code</span><input value={draft.postalCode} onChange={(event)=>setDraft((current)=>({...current,postalCode:event.target.value}))} autoComplete="postal-code"/></label>
      </div>

      <div className="profile-section-heading"><UserRound size={20}/><div><strong>Emergency contact</strong><span>Optional and patient controlled</span></div></div>
      <div className="profile-form-grid three-column-grid">
        <label><span>Contact name</span><input value={draft.emergencyContactName} onChange={(event)=>setDraft((current)=>({...current,emergencyContactName:event.target.value}))} placeholder="Full name"/></label>
        <label><span>Relationship</span><input value={draft.emergencyContactRelationship} onChange={(event)=>setDraft((current)=>({...current,emergencyContactRelationship:event.target.value}))} placeholder="Relationship"/></label>
        <label><span>Phone number</span><input type="tel" value={draft.emergencyContactPhone} onChange={(event)=>setDraft((current)=>({...current,emergencyContactPhone:event.target.value}))} placeholder="(555) 555-0123"/></label>
      </div>

      <div className="profile-section-heading"><ShieldCheck size={20}/><div><strong>Clinical basics</strong><span>These appear in clinician-facing summaries when present</span></div></div>
      <div className="profile-clinical-grid">
        <label className="profile-list-field"><span>Conditions</span><textarea value={draft.conditions.join('\n')} onChange={(event)=>setDraft((current)=>({...current,conditions:linesToList(event.target.value)}))} rows={5} placeholder="One condition per line"/></label>
        <label className="profile-list-field"><span>Allergies</span><textarea value={draft.allergies.join('\n')} onChange={(event)=>setDraft((current)=>({...current,allergies:linesToList(event.target.value)}))} rows={5} placeholder="One allergy per line, or leave blank"/></label>
      </div>

      {error&&<div className="profile-error">{error}</div>}
      <div className="profile-actions"><button className="button primary" onClick={save} disabled={photoBusy}>{saved?<><Check size={17}/> Saved</>:<>Save patient profile</>}</button><span>{auth.user?'Changes sync with your cloud Passport.':'Changes remain in this browser until you sign in.'}</span></div>
    </section>
  </div>
}
