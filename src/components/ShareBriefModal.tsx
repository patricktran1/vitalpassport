import { Check, Clock3, Copy, Eye, Link2, LoaderCircle, QrCode, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { createShareLink, demoShareUrl, listShareLinks, revokeShareLink } from '../lib/sharing'
import type { ShareLinkRecord, SharedBriefPacket } from '../types'
import { Modal } from './Modal'

interface ShareBriefModalProps {
  packet: SharedBriefPacket
  initialMode?: 'link' | 'qr'
  onClose: () => void
}

function formatDate(value: string) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function linkStatus(link: ShareLinkRecord) {
  if (link.revokedAt) return 'Revoked'
  if (new Date(link.expiresAt).getTime() <= Date.now()) return 'Expired'
  return 'Active'
}

export function ShareBriefModal({ packet, initialMode = 'link', onClose }: ShareBriefModalProps) {
  const auth = useAuth()
  const [links, setLinks] = useState<ShareLinkRecord[]>([])
  const [activeLink, setActiveLink] = useState<ShareLinkRecord | null>(null)
  const [duration, setDuration] = useState(72)
  const [label, setLabel] = useState('Primary care visit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState(initialMode)

  const cloudReady = Boolean(auth.configured && auth.user)
  const incomplete = packet.readiness.openInterviewGaps > 0 || packet.readiness.openReconciliationCount > 0
  const demoLink = useMemo<ShareLinkRecord>(() => ({
    id: 'demo',
    label: 'Synthetic demonstration',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
    lastAccessedAt: null,
    accessCount: 0,
    url: demoShareUrl(),
  }), [])

  const refresh = async () => {
    if (!auth.user) return
    try {
      const next = await listShareLinks(auth.user.id)
      setLinks(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load share links.')
    }
  }

  useEffect(() => {
    if (cloudReady) void refresh()
    else setActiveLink(demoLink)
  }, [cloudReady])

  const createLink = async () => {
    if (!auth.user) {
      setActiveLink(demoLink)
      return
    }
    setLoading(true)
    setError('')
    try {
      const link = await createShareLink(auth.user.id, packet, duration, label)
      setActiveLink(link)
      setLinks((current) => [link, ...current])
      setMode(initialMode)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the link.')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async (link = activeLink) => {
    if (!link?.url) return
    await navigator.clipboard.writeText(link.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const revoke = async (link: ShareLinkRecord) => {
    if (!auth.user) return
    setLoading(true)
    setError('')
    try {
      await revokeShareLink(auth.user.id, link.id)
      setLinks((current) => current.map((item) => item.id === link.id ? { ...item, revokedAt: new Date().toISOString(), url: undefined, token: undefined } : item))
      if (activeLink?.id === link.id) setActiveLink(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not revoke the link.')
    } finally {
      setLoading(false)
    }
  }

  return <Modal title="Share clinician brief" onClose={onClose}>
    <div className="share-security-note"><ShieldCheck size={18}/><div><strong>View-only snapshot</strong><span>The shared packet is frozen at creation. It cannot edit the patient record or open the patient account.</span></div></div>

    {incomplete && <div className="share-readiness-warning"><TriangleAlert size={17}/><span>This brief still has {packet.readiness.openInterviewGaps} interview gap{packet.readiness.openInterviewGaps===1?'':'s'} and {packet.readiness.openReconciliationCount} unresolved source conflict{packet.readiness.openReconciliationCount===1?'':'s'}. You can still share it, and the uncertainty will remain visible.</span></div>}

    {!cloudReady && <div className="share-demo-banner"><QrCode size={18}/><div><strong>Synthetic demo sharing</strong><span>{auth.configured ? 'Sign in from the sidebar to create revocable links across devices.' : 'Configure Supabase to activate expiring, revocable links. This demo URL opens Maria’s synthetic packet.'}</span></div></div>}

    {cloudReady && !activeLink && <div className="share-create-form">
      <label><span>Link label</span><input value={label} onChange={(event)=>setLabel(event.target.value)} placeholder="Primary care visit"/></label>
      <div><span className="field-label">Expires after</span><div className="duration-options">{[{hours:24,label:'24 hours'},{hours:72,label:'72 hours'},{hours:168,label:'7 days'}].map((option)=><button key={option.hours} className={duration===option.hours?'active':''} onClick={()=>setDuration(option.hours)}>{option.label}</button>)}</div></div>
      <button className="button primary full" disabled={loading} onClick={createLink}>{loading?<><LoaderCircle className="spin" size={17}/> Creating secure link</>:<><Link2 size={17}/> Create expiring link</>}</button>
    </div>}

    {!cloudReady && !activeLink && <button className="button primary full" onClick={()=>setActiveLink(demoLink)}><Link2 size={17}/> Open demo sharing packet</button>}

    {activeLink?.url && <div className="active-share-card">
      <div className="share-mode-tabs"><button className={mode==='link'?'active':''} onClick={()=>setMode('link')}><Link2 size={15}/> Link</button><button className={mode==='qr'?'active':''} onClick={()=>setMode('qr')}><QrCode size={15}/> QR code</button></div>
      {mode==='link'?<>
        <div className="share-link-box"><Link2 size={18}/><span>{activeLink.url}</span><button onClick={()=>copyLink()}>{copied?'Copied':'Copy'}</button></div>
        <div className="share-settings"><div><Clock3 size={14}/><span><strong>Expires</strong>{formatDate(activeLink.expiresAt)}</span></div><div><Eye size={14}/><span><strong>Views</strong>{activeLink.accessCount}</span></div></div>
      </>:<div className="qr-panel compact"><QRCodeSVG value={activeLink.url} size={205} bgColor="#ffffff" fgColor="#173a3a" level="M"/><h3>Scan at check-in</h3><p>Opens only this frozen, view-only clinician packet.</p></div>}
      {cloudReady && <div className="button-row share-active-actions"><button className="button ghost" onClick={()=>setActiveLink(null)}>Create another</button><button className="button ghost danger-button" disabled={loading} onClick={()=>revoke(activeLink)}><Trash2 size={15}/> Revoke</button></div>}
    </div>}

    {error && <div className="extraction-error compact"><TriangleAlert size={18}/><div><strong>Sharing could not complete</strong><span>{error}</span></div></div>}

    {cloudReady && links.length>0 && <section className="share-history">
      <div className="share-history-heading"><div><strong>Recent links</strong><span>Only the device that created a link can recover its raw URL. Every device can revoke it.</span></div><button onClick={()=>void refresh()}>Refresh</button></div>
      <div className="share-history-list">{links.map((link)=>{
        const status=linkStatus(link)
        return <div className={`share-history-row ${status.toLowerCase()}`} key={link.id}>
          <div><strong>{link.label}</strong><span>{status} · expires {formatDate(link.expiresAt)}</span><small>{link.accessCount} view{link.accessCount===1?'':'s'} · last opened {formatDate(link.lastAccessedAt || '')}</small></div>
          <div>{link.url&&status==='Active'&&<button title="Copy link" onClick={()=>copyLink(link)}><Copy size={15}/></button>}{status==='Active'&&<button title="Revoke link" onClick={()=>revoke(link)}><Trash2 size={15}/></button>}{status==='Revoked'&&<Check size={16}/>}</div>
        </div>
      })}</div>
    </section>}
  </Modal>
}
