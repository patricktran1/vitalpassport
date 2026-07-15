import type { SharedBriefPacket } from '../types'

type FhirResource = Record<string, unknown>

type FhirBundleEntry = {
  fullUrl: string
  resource: FhirResource
}

export interface FhirExportSummary {
  bundle: FhirResource
  resourceCounts: Record<string, number>
  warnings: string[]
}

function cleanId(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return (cleaned || 'item').slice(0, 54)
}

function stableId(prefix: string, value: string, index = 0) {
  let hash = 2166136261
  const input = `${value}:${index}`
  for (let cursor = 0; cursor < input.length; cursor += 1) {
    hash ^= input.charCodeAt(cursor)
    hash = Math.imul(hash, 16777619)
  }
  return `${prefix}-${cleanId(value).slice(0, 38)}-${(hash >>> 0).toString(36)}`.slice(0, 64)
}

function patientReference(patientId: string) {
  return { reference: `Patient/${patientId}`, display: 'Vital Passport patient' }
}

function parseDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString().slice(0, 10)
}

function parseNumeric(value: string) {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number.parseFloat(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function encodeUtf8(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function addEntry(entries: FhirBundleEntry[], resource: FhirResource) {
  const resourceType = String(resource.resourceType)
  const id = String(resource.id)
  entries.push({ fullUrl: `urn:uuid:${resourceType.toLowerCase()}-${id}`, resource })
}

export function buildFhirR4Bundle(packet: SharedBriefPacket): FhirExportSummary {
  const patientId = stableId('patient', `${packet.patient.name}-${packet.patient.dob}`)
  const entries: FhirBundleEntry[] = []
  const warnings: string[] = []
  const generatedTargets: string[] = []
  const sourceReferences: string[] = []

  addEntry(entries, {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      tag: [{ system: 'https://vitalpassport.com/fhir/tags', code: 'patient-controlled', display: 'Patient controlled export' }],
    },
    name: [{ text: packet.patient.name }],
    birthDate: parseDate(packet.patient.dob),
    communication: packet.patient.pronouns ? [{ language: { text: `Pronouns: ${packet.patient.pronouns}` } }] : undefined,
  })
  generatedTargets.push(`Patient/${patientId}`)

  packet.patient.conditions.forEach((condition, index) => {
    const id = stableId('condition', condition, index)
    addEntry(entries, {
      resourceType: 'Condition',
      id,
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'unconfirmed' }] },
      code: { text: condition },
      subject: patientReference(patientId),
      note: [{ text: 'Imported from a patient-controlled Vital Passport summary; confirm against clinical records.' }],
    })
    generatedTargets.push(`Condition/${id}`)
  })

  packet.patient.allergies.forEach((allergy, index) => {
    const id = stableId('allergy', allergy, index)
    const noKnown = /no known|nkda/i.test(allergy)
    addEntry(entries, {
      resourceType: 'AllergyIntolerance',
      id,
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'unconfirmed' }] },
      type: 'allergy',
      category: ['medication'],
      criticality: 'unable-to-assess',
      code: { text: noKnown ? 'No known drug allergies (patient reported)' : allergy },
      patient: patientReference(patientId),
      note: [{ text: 'Patient-controlled statement; verification status is intentionally unconfirmed.' }],
    })
    generatedTargets.push(`AllergyIntolerance/${id}`)
  })

  packet.medications.forEach((medication, index) => {
    const id = stableId('medication', `${medication.name}-${medication.strength}-${medication.directions}`, index)
    const unresolved = medication.status === 'conflict' || medication.status === 'needs_review'
    if (unresolved) warnings.push(`${medication.name} has unresolved or review-needed instructions.`)
    addEntry(entries, {
      resourceType: 'MedicationStatement',
      id,
      status: unresolved ? 'unknown' : 'active',
      medicationCodeableConcept: { text: [medication.name, medication.strength].filter(Boolean).join(' ') },
      subject: patientReference(patientId),
      dateAsserted: packet.preparedAt,
      informationSource: patientReference(patientId),
      dosage: medication.directions ? [{ text: medication.directions }] : undefined,
      note: [{ text: `Vital Passport status: ${medication.status}. Supported by ${medication.sourceCount} source${medication.sourceCount === 1 ? '' : 's'}.` }],
    })
    generatedTargets.push(`MedicationStatement/${id}`)
  })

  packet.labs.forEach((lab, index) => {
    const id = stableId('observation', `${lab.test}-${lab.eventDate}-${lab.value}`, index)
    const numericValue = parseNumeric(lab.value)
    const value = numericValue === null
      ? { valueString: [lab.value, lab.unit].filter(Boolean).join(' ') }
      : { valueQuantity: { value: numericValue, unit: lab.unit || undefined } }
    addEntry(entries, {
      resourceType: 'Observation',
      id,
      status: 'final',
      category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
      code: { text: lab.test },
      subject: patientReference(patientId),
      effectiveDateTime: parseDate(lab.eventDate),
      ...value,
      interpretation: lab.abnormalFlag ? [{ text: lab.abnormalFlag }] : undefined,
      referenceRange: lab.trend ? [{ text: `Vital Passport trend: ${lab.trend}` }] : undefined,
      note: [{ text: 'Source-linked patient export. Units and reference ranges should be verified against the original report.' }],
    })
    generatedTargets.push(`Observation/${id}`)
  })

  packet.openTasks.forEach((task, index) => {
    const id = stableId('task', `${task.title}-${task.detail}`, index)
    addEntry(entries, {
      resourceType: 'Task',
      id,
      status: 'requested',
      intent: 'order',
      priority: 'routine',
      description: task.title,
      for: patientReference(patientId),
      authoredOn: packet.preparedAt,
      note: [{ text: [task.detail, task.dueLabel].filter(Boolean).join(' · ') }],
    })
    generatedTargets.push(`Task/${id}`)
  })

  packet.sources.forEach((source, index) => {
    const id = stableId('document', `${source.id}-${source.title}`, index)
    const sourceText = [source.title, source.subtitle, source.excerpt, ...source.details.map((detail) => `${detail.label}: ${detail.value}`)].join('\n')
    addEntry(entries, {
      resourceType: 'DocumentReference',
      id,
      status: 'current',
      type: { text: source.type },
      subject: patientReference(patientId),
      date: source.date ? new Date(`${source.date}T12:00:00Z`).toISOString() : packet.preparedAt,
      description: source.title,
      content: [{ attachment: { contentType: 'text/plain; charset=utf-8', title: source.title, data: encodeUtf8(sourceText) } }],
      context: { related: [{ identifier: { system: 'https://vitalpassport.com/source-id', value: source.id } }] },
    })
    const reference = `DocumentReference/${id}`
    sourceReferences.push(reference)
    generatedTargets.push(reference)
  })

  const provenanceId = stableId('provenance', packet.preparedAt)
  addEntry(entries, {
    resourceType: 'Provenance',
    id: provenanceId,
    target: generatedTargets.map((reference) => ({ reference })),
    recorded: packet.preparedAt,
    policy: ['https://vitalpassport.com/policies/patient-controlled-export'],
    agent: [{
      type: { text: 'Patient-controlled application' },
      who: { reference: `Patient/${patientId}`, display: packet.patient.name },
      onBehalfOf: { display: 'Vital Passport' },
    }],
    entity: sourceReferences.map((reference) => ({ role: 'source', what: { reference } })),
    reason: [{ text: 'Patient-directed clinical handoff and continuity of care.' }],
  })

  if (packet.readiness.openInterviewGaps > 0) warnings.push(`${packet.readiness.openInterviewGaps} patient interview gap${packet.readiness.openInterviewGaps === 1 ? ' remains' : 's remain'}.`)
  if (packet.readiness.openReconciliationCount > 0) warnings.push(`${packet.readiness.openReconciliationCount} reconciliation conflict${packet.readiness.openReconciliationCount === 1 ? ' remains' : 's remain'}.`)

  const resourceCounts = entries.reduce<Record<string, number>>((counts, entry) => {
    const resourceType = String(entry.resource.resourceType)
    counts[resourceType] = (counts[resourceType] || 0) + 1
    return counts
  }, {})

  return {
    bundle: {
      resourceType: 'Bundle',
      id: stableId('bundle', `${packet.patient.name}-${packet.preparedAt}`),
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
        tag: [
          { system: 'https://vitalpassport.com/fhir/tags', code: 'patient-generated', display: 'Patient-generated health data' },
          { system: 'https://vitalpassport.com/fhir/tags', code: 'verify-sources', display: 'Verify against original sources' },
        ],
      },
      identifier: { system: 'https://vitalpassport.com/fhir/bundles', value: stableId('export', `${packet.patient.name}-${packet.preparedAt}`) },
      type: 'collection',
      timestamp: packet.preparedAt,
      entry: entries,
    },
    resourceCounts,
    warnings,
  }
}
