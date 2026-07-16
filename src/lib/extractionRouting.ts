import type { HealthExtraction, HealthItemType } from '../types'

const genericTitle = /^(health information|uploaded health information|health document|document|medical document|image|photo)$/i

function medicationTitle(extraction: HealthExtraction) {
  const medication = extraction.medications[0]
  if (!medication) return 'Medication information'
  return [medication.name, medication.strength].filter(Boolean).join(' ') + ' prescription'
}

function medicationSummary(extraction: HealthExtraction) {
  const medication = extraction.medications[0]
  if (!medication) return extraction.summary
  return [medication.name, medication.strength, medication.directions].filter(Boolean).join(' · ')
}

function labSummary(extraction: HealthExtraction) {
  const abnormal = extraction.lab_results.filter((result) => result.abnormal_flag && !/normal|within|negative/i.test(result.abnormal_flag))
  const count = extraction.lab_results.length
  if (!count) return extraction.summary
  return `${count} lab ${count === 1 ? 'result' : 'results'} extracted${abnormal.length ? ` · ${abnormal.length} flagged for review` : ''}.`
}

export function routedItemType(extraction: HealthExtraction, fallback: HealthItemType): HealthItemType {
  if (extraction.document_type === 'medication_bottle' || extraction.medications.length) return 'medication'
  if (extraction.document_type === 'lab_report' || extraction.lab_results.length) return 'lab'
  if (extraction.document_type === 'symptom_note' || extraction.symptoms.length) return 'symptom'
  if (extraction.document_type === 'question') return 'question'
  if (extraction.document_type === 'health_photo') return 'photo'
  if (['after_visit_summary', 'discharge_summary', 'imaging_report'].includes(extraction.document_type)) return 'document'
  return fallback
}

export function semanticExtractionTitle(extraction: HealthExtraction, fallback = 'Health information') {
  if (extraction.document_type === 'medication_bottle' || extraction.medications.length) return medicationTitle(extraction)
  if (extraction.document_type === 'lab_report' || extraction.lab_results.length) return extraction.facility ? `${extraction.facility} laboratory results` : 'Laboratory results'
  if (extraction.document_type === 'after_visit_summary') return extraction.facility ? `${extraction.facility} after-visit summary` : 'After-visit summary'
  if (extraction.document_type === 'discharge_summary') return extraction.facility ? `${extraction.facility} discharge summary` : 'Hospital discharge summary'
  if (extraction.document_type === 'imaging_report') return extraction.facility ? `${extraction.facility} imaging report` : 'Imaging report'
  if (extraction.document_type === 'symptom_note' || extraction.symptoms.length) return extraction.symptoms[0] ? `Symptom update: ${extraction.symptoms[0]}` : 'Symptom update'
  if (extraction.document_type === 'question') return 'Question for the next visit'
  if (extraction.document_type === 'health_photo') return 'Health photo'
  return extraction.title && !genericTitle.test(extraction.title.trim()) ? extraction.title : fallback
}

export function semanticExtractionSummary(extraction: HealthExtraction) {
  if (extraction.document_type === 'medication_bottle' || extraction.medications.length) return medicationSummary(extraction)
  if (extraction.document_type === 'lab_report' || extraction.lab_results.length) return labSummary(extraction)
  if (extraction.document_type === 'after_visit_summary') return extraction.summary || 'After-visit instructions and follow-up details were extracted for patient review.'
  if (extraction.document_type === 'discharge_summary') return extraction.summary || 'Hospital discharge diagnoses, medications, and follow-up instructions were extracted for patient review.'
  if (extraction.document_type === 'imaging_report') return extraction.summary || 'Imaging findings were extracted for patient review.'
  return extraction.summary
}

export function routeHealthExtraction(extraction: HealthExtraction, fallbackType: HealthItemType, fallbackTitle?: string) {
  const type = routedItemType(extraction, fallbackType)
  const title = semanticExtractionTitle(extraction, fallbackTitle)
  const summary = semanticExtractionSummary(extraction)
  return {
    type,
    extraction: {
      ...extraction,
      title,
      summary,
    },
  }
}

export function genericTimelineReplacement(category: 'symptoms' | 'medications' | 'visits' | 'results' | 'documents', sourceDetails: Array<{ label: string; value: string }>, currentTitle: string, currentSummary: string) {
  if (!genericTitle.test(currentTitle.trim())) return { title: currentTitle, summary: currentSummary }
  if (category === 'medications') {
    const medication = sourceDetails.find((detail) => detail.label === 'Medication')
    return { title: medication ? `${medication.value.split(' · ')[0]} added` : 'Medication added', summary: medication?.value || currentSummary }
  }
  if (category === 'results') return { title: 'Laboratory results', summary: sourceDetails.slice(0, 3).map((detail) => `${detail.label}: ${detail.value}`).join(' · ') || currentSummary }
  if (category === 'visits') return { title: 'Visit summary', summary: currentSummary }
  if (category === 'symptoms') return { title: 'Symptom update', summary: sourceDetails.find((detail) => detail.label === 'Symptom')?.value || currentSummary }
  return { title: 'Health document', summary: currentSummary }
}
