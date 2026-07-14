import type { Medication, SourceRecord, TimelineEvent } from '../types'

export const patient = {
  name: 'Maria Santos',
  firstName: 'Maria',
  initials: 'MS',
  age: 62,
  dob: 'May 12, 1964',
  pronouns: 'she/her',
  conditions: ['Type 2 diabetes', 'Hypertension', 'Mild anemia'],
  allergies: ['No known drug allergies'],
  emergencyContact: 'Elena Santos · Daughter · (415) 555-0184',
}

export const sources: SourceRecord[] = [
  {
    id: 'src-avs',
    title: 'Urgent care after-visit summary',
    subtitle: 'Bayview Urgent Care · July 2, 2026',
    date: '2026-07-02',
    type: 'document',
    excerpt: 'Patient evaluated for intermittent dizziness and fatigue. Continue metoprolol 25 mg twice daily and follow up with primary care within 1–2 weeks.',
    details: [
      { label: 'Reason for visit', value: 'Dizziness and fatigue' },
      { label: 'Medication listed', value: 'Metoprolol 25 mg twice daily', highlight: true },
      { label: 'Instruction', value: 'Follow up with primary care within 1–2 weeks' },
    ],
  },
  {
    id: 'src-bottle',
    title: 'Metoprolol bottle photo',
    subtitle: 'Patient upload · July 10, 2026',
    date: '2026-07-10',
    type: 'medication',
    excerpt: 'METOPROLOL SUCCINATE ER 50 MG TABLET. Take one tablet by mouth every morning.',
    details: [
      { label: 'Medication', value: 'Metoprolol succinate ER' },
      { label: 'Dose', value: '50 mg', highlight: true },
      { label: 'Directions', value: 'Take one tablet every morning', highlight: true },
      { label: 'Prescriber', value: 'J. Kim, MD' },
    ],
  },
  {
    id: 'src-labs',
    title: 'Laboratory report',
    subtitle: 'Bayview Medical Group · July 2, 2026',
    date: '2026-07-02',
    type: 'lab',
    excerpt: 'CBC and metabolic panel. Hemoglobin 10.8 g/dL (low). Glucose 168 mg/dL (high). Creatinine and electrolytes within reference range.',
    details: [
      { label: 'Hemoglobin', value: '10.8 g/dL · Low', highlight: true },
      { label: 'Glucose', value: '168 mg/dL · High', highlight: true },
      { label: 'Creatinine', value: '0.9 mg/dL · Normal' },
      { label: 'Potassium', value: '4.2 mmol/L · Normal' },
    ],
  },
  {
    id: 'src-voice',
    title: 'Symptom voice note',
    subtitle: 'Patient recording · July 12, 2026',
    date: '2026-07-12',
    type: 'voice',
    excerpt: 'I feel lightheaded most mornings and sometimes when I get up from the couch. I have also been more tired than usual for about three weeks.',
    details: [
      { label: 'Symptoms', value: 'Lightheadedness and fatigue' },
      { label: 'Pattern', value: 'Mostly mornings; sometimes after standing' },
      { label: 'Duration', value: 'Approximately three weeks' },
    ],
  },
  {
    id: 'src-bp',
    title: 'Home blood pressure log',
    subtitle: 'Patient-entered readings · July 8–13, 2026',
    date: '2026-07-13',
    type: 'document',
    excerpt: 'Six recent home readings. Lowest recorded blood pressure was 104/66 on July 12 at 8:10 AM.',
    details: [
      { label: 'July 8', value: '118/72 · 8:30 AM' },
      { label: 'July 10', value: '110/68 · 8:15 AM' },
      { label: 'July 12', value: '104/66 · 8:10 AM', highlight: true },
      { label: 'July 13', value: '112/70 · 7:55 AM' },
    ],
  },
]

export const medications: Medication[] = [
  { name: 'Metformin', dose: '500 mg', frequency: 'Twice daily', status: 'verified', source: 'Medication bottle', sourceId: 'src-bottle' },
  { name: 'Lisinopril', dose: '10 mg', frequency: 'Once daily', status: 'verified', source: 'Medication bottle', sourceId: 'src-bottle' },
  { name: 'Metoprolol', dose: '25 mg twice daily or 50 mg once daily', frequency: 'Conflicting sources', status: 'conflict', source: 'AVS + bottle photo', sourceId: 'src-avs' },
]

export const timeline: TimelineEvent[] = [
  {
    id: 't1', date: '2026-06-20', displayDate: 'Jun 20', category: 'symptoms', title: 'Dizziness and fatigue began',
    summary: 'Maria recalls intermittent morning lightheadedness and increased fatigue beginning around this date.', sourceLabel: 'Patient reported', sourceType: 'patient', sourceId: 'src-voice',
  },
  {
    id: 't2', date: '2026-06-24', displayDate: 'Jun 24', category: 'medications', title: 'Metoprolol prescription changed',
    summary: 'Bottle photograph suggests a 50 mg extended-release prescription. Exact start date still needs confirmation.', sourceLabel: 'AI extracted · verify', sourceType: 'ai', sourceId: 'src-bottle',
  },
  {
    id: 't3', date: '2026-07-02', displayDate: 'Jul 2', category: 'visits', title: 'Urgent care visit',
    summary: 'Evaluated for dizziness and fatigue. Advised to follow up with primary care in 1–2 weeks.', sourceLabel: 'Documented', sourceType: 'documented', sourceId: 'src-avs',
  },
  {
    id: 't4', date: '2026-07-02', displayDate: 'Jul 2', category: 'results', title: 'Blood tests completed',
    summary: 'Hemoglobin 10.8 g/dL and glucose 168 mg/dL. Creatinine and electrolytes were within reference range.', sourceLabel: 'Documented', sourceType: 'documented', sourceId: 'src-labs',
  },
  {
    id: 't5', date: '2026-07-10', displayDate: 'Jul 10', category: 'documents', title: 'Medication bottle photographed',
    summary: 'Bottle label shows metoprolol succinate ER 50 mg once each morning.', sourceLabel: 'Patient upload', sourceType: 'documented', sourceId: 'src-bottle',
  },
  {
    id: 't6', date: '2026-07-12', displayDate: 'Jul 12', category: 'symptoms', title: 'Positional symptoms noted',
    summary: 'Voice note mentions occasional lightheadedness after getting up from the couch.', sourceLabel: 'Patient reported', sourceType: 'patient', sourceId: 'src-voice',
  },
  {
    id: 't7', date: '2026-07-12', displayDate: 'Jul 12', category: 'results', title: 'Lowest recent home BP',
    summary: 'Home reading was 104/66 at 8:10 AM.', sourceLabel: 'Patient entered', sourceType: 'patient', sourceId: 'src-bp',
  },
  {
    id: 't8', date: '2026-07-18', displayDate: 'Jul 18', category: 'visits', title: 'Primary care appointment',
    summary: 'Upcoming visit with Dr. Jordan Kim at Bayview Medical Group.', sourceLabel: 'Scheduled', sourceType: 'documented',
  },
]

export const recentUploads = [
  { id: 'u1', name: 'Metoprolol bottle', type: 'medication' as const, date: 'Jul 10', status: 'ready' as const, summary: '50 mg once daily extracted' },
  { id: 'u2', name: 'Urgent care summary', type: 'document' as const, date: 'Jul 2', status: 'ready' as const, summary: 'Visit details and instructions extracted' },
  { id: 'u3', name: 'Lab report', type: 'lab' as const, date: 'Jul 2', status: 'ready' as const, summary: '12 results extracted · 2 flagged' },
]
