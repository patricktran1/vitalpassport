import { Mic, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type RecognitionAlternative = { transcript: string }
type RecognitionResult = { isFinal: boolean; [index: number]: RecognitionAlternative }
type RecognitionEvent = { resultIndex: number; results: { length: number; [index: number]: RecognitionResult } }
type RecognitionErrorEvent = { error: string }

type RecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type RecognitionConstructor = new () => RecognitionInstance

type VoiceInputButtonProps = {
  onTranscript: (transcript: string) => void
  disabled?: boolean
  className?: string
  label?: string
}

function recognitionConstructor() {
  if (typeof window === 'undefined') return null
  const speechWindow = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null
}

function friendlyError(code: string) {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Microphone permission was not granted.'
  if (code === 'audio-capture') return 'No microphone was available.'
  if (code === 'no-speech') return 'No speech was detected. Try again.'
  return 'Voice typing could not start in this browser.'
}

export function VoiceInputButton({ onTranscript, disabled = false, className = '', label = 'Speak instead of typing' }: VoiceInputButtonProps) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef<RecognitionInstance | null>(null)

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const Recognition = recognitionConstructor()
    if (!Recognition) {
      setError('Voice typing is not available in this browser. You can still type your message.')
      return
    }

    const recognition = new Recognition()
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const segments: string[] = []
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal && result[0]?.transcript) segments.push(result[0].transcript.trim())
      }
      const transcript = segments.join(' ').trim()
      if (transcript) onTranscript(transcript)
    }
    recognition.onerror = (event) => {
      setError(friendlyError(event.error))
      setListening(false)
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setError('')
    setListening(true)
    try {
      recognition.start()
    } catch {
      setListening(false)
      setError('Voice typing could not start. Try again or type your message.')
    }
  }

  return (
    <span className={`voice-input-wrap ${className}`.trim()}>
      <button
        type="button"
        className={`voice-input-button ${listening ? 'listening' : ''}`}
        onClick={toggle}
        disabled={disabled}
        aria-label={listening ? 'Stop voice typing' : label}
        aria-pressed={listening}
        title={error || (listening ? 'Listening. Tap to stop.' : label)}
      >
        {listening ? <Square size={15} /> : <Mic size={18} />}
      </button>
      {listening && <span className="voice-input-live" aria-live="polite">Listening…</span>}
      {error && <span className="voice-input-error" role="status">{error}</span>}
    </span>
  )
}
