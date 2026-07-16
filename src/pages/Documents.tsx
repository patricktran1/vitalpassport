import { ExternalLink, FileCheck2, FileLock2, FileText, LoaderCircle, PlusCircle, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { createSourceDocumentUrl, deleteSourceDocument, listSourceDocuments, type SourceDocumentRecord } from '../lib/sourceDocuments'

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${Math.round((value / (1024 * 1024)) * 10) / 10} MB`
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently added'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function Documents() {
  const auth = useAuth()
  const workspace = useWorkspace()
  const [documents, setDocuments] = useState<SourceDocumentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const load = useCallback(async () => {
    if (!auth.user || workspace.isDemo) {
      setDocuments([])
      return
    }
    setLoading(true)
    setError('')
    try {
      setDocuments(await listSourceDocuments(auth.user.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Private sources could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [auth.user?.id, workspace.isDemo])

  useEffect(() => { void load() }, [load])

  const openDocument = async (document: SourceDocumentRecord) => {
    if (document.sourceKind !== 'file') return
    setOpeningId(document.id)
    setError('')
    try {
      const url = await createSourceDocumentUrl(document)
      if (!url) throw new Error('This source does not have an original file.')
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The private source could not be opened.')
    } finally {
      setOpeningId('')
    }
  }

  const removeDocument = async (document: SourceDocumentRecord) => {
    if (!auth.user) return
    if (!window.confirm(`Permanently delete “${document.originalFilename}” and its private source metadata? Confirmed facts already added to the Passport are not automatically removed.`)) return
    setDeletingId(document.id)
    setError('')
    try {
      await deleteSourceDocument(auth.user.id, document)
      setDocuments((current) => current.filter((item) => item.id !== document.id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The source document could not be deleted.')
    } finally {
      setDeletingId('')
    }
  }

  if (workspace.isDemo) return <div className="page source-library-page">
    <section className="page-heading"><div className="eyebrow">Private source library</div><h1>Original documents stay out of the demo.</h1><p>Maria’s synthetic source summaries remain available throughout the demo, but no files are uploaded to your Supabase account.</p></section>
    <section className="source-library-state"><FileLock2 size={34}/><h2>Demo workspace is cloud-inert</h2><p>Switch to your personal Passport to upload private source files and carry them across devices.</p><button className="button primary" onClick={workspace.startPersonal}>Open my personal Passport</button></section>
  </div>

  if (!auth.user) return <div className="page source-library-page">
    <section className="page-heading"><div className="eyebrow">Private source library</div><h1>Keep the original evidence with your health story.</h1><p>Sign in to store original PDFs and images privately, review them through short-lived links, and delete them whenever you choose.</p></section>
    <section className="source-library-state"><FileLock2 size={34}/><h2>Sign in from the sidebar</h2><p>Your local Passport still works without an account. Private source storage activates after Supabase sign-in.</p></section>
  </div>

  return <div className="page source-library-page">
    <section className="page-heading split-heading"><div><div className="eyebrow">Private source library</div><h1>Original sources, protected and traceable.</h1><p>Each saved source keeps its checksum, extraction provenance, page selection, and link to the structured record.</p></div><Link className="button primary" to="/add"><PlusCircle size={16}/> Add source</Link></section>

    <section className="source-security-strip"><ShieldCheck size={19}/><div><strong>Private by default</strong><span>Files are served through five-minute signed links. The storage path begins with your authenticated user ID and is protected by Supabase Row Level Security.</span></div></section>

    {error&&<div className="source-library-error"><TriangleAlert size={18}/><span>{error}</span><button onClick={()=>void load()}>Try again</button></div>}

    {loading&&<section className="source-library-state compact"><LoaderCircle className="spin" size={28}/><h2>Loading private sources</h2></section>}

    {!loading&&documents.length===0&&<section className="source-library-state"><FileText size={34}/><h2>No account-backed sources yet</h2><p>Add a PDF, image, or manual source. Signed-in personal uploads will appear here after confirmation.</p><Link className="button primary" to="/add">Add health information</Link></section>}

    {!loading&&documents.length>0&&<div className="source-document-list">{documents.map((document)=><article className="source-document-card" key={document.id}>
      <div className="source-document-icon">{document.sourceKind==='file'?<FileCheck2 size={22}/>:<FileText size={22}/>}</div>
      <div className="source-document-main">
        <div className="source-document-heading"><div><div className="eyebrow">{document.itemType.replace('_',' ')} · {document.sourceKind==='file'?'Original file':'Manual source'}</div><h2>{document.title}</h2></div><span className="source-document-status">{document.extractionStatus}</span></div>
        <p>{document.summary}</p>
        <div className="source-document-meta"><span><strong>Source</strong>{document.originalFilename}</span><span><strong>Added</strong>{formatDate(document.createdAt)}</span><span><strong>Size</strong>{formatBytes(document.sizeBytes)}</span>{document.pageCount&&<span><strong>Pages</strong>{document.selectedPages.length?`${document.selectedPages.join(', ')} of ${document.pageCount}`:document.pageCount}</span>}</div>
        <div className="source-document-provenance"><code>SHA-256 {document.sha256.slice(0,16)}…</code><span>{document.extractionModel}</span>{document.facility&&<span>{document.facility}</span>}</div>
      </div>
      <div className="source-document-actions">{document.sourceKind==='file'&&<button className="button ghost" onClick={()=>void openDocument(document)} disabled={openingId===document.id}>{openingId===document.id?<LoaderCircle className="spin" size={15}/>:<ExternalLink size={15}/>} Open original</button>}<button className="button danger-outline" onClick={()=>void removeDocument(document)} disabled={deletingId===document.id}>{deletingId===document.id?<LoaderCircle className="spin" size={15}/>:<Trash2 size={15}/>} Delete</button></div>
    </article>)}</div>}
  </div>
}
