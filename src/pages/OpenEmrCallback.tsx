import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { completeOpenEmrAuthorization } from '../lib/openemr'

export function OpenEmrCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading')
  const [message, setMessage] = useState('Exchanging the authorization code securely…')

  useEffect(() => {
    const code = searchParams.get('code') || ''
    const state = searchParams.get('state') || ''
    const returnedError = searchParams.get('error_description') || searchParams.get('error') || ''
    if (returnedError) {
      setStatus('error')
      setMessage(returnedError)
      return
    }
    if (!code || !state) {
      setStatus('error')
      setMessage('OpenEMR did not return the required authorization code and state.')
      return
    }
    void completeOpenEmrAuthorization(code, state)
      .then(() => {
        setStatus('success')
        setMessage('OpenEMR authorization completed. Returning to the import review.')
        window.setTimeout(() => window.location.assign('/openemr'), 900)
      })
      .catch((caught) => {
        setStatus('error')
        setMessage(caught instanceof Error ? caught.message : 'OpenEMR authorization could not be completed.')
      })
  }, [searchParams])

  return <main className="openemr-callback-page">
    <section className={`openemr-callback-card ${status}`}>
      {status === 'loading' && <LoaderCircle className="spin" size={34}/>} 
      {status === 'success' && <CheckCircle2 size={34}/>} 
      {status === 'error' && <TriangleAlert size={34}/>} 
      <div><div className="eyebrow">OpenEMR connection</div><h1>{status === 'loading' ? 'Completing authorization' : status === 'success' ? 'Connected' : 'Connection failed'}</h1><p>{message}</p>{status === 'error' && <a className="button primary" href="/openemr">Return to OpenEMR setup</a>}</div>
    </section>
  </main>
}
