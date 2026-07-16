import type { HealthExtraction, HealthItemType } from '../types'
import { routeHealthExtraction } from './extractionRouting'
import { supabase } from './supabase'

export const SOURCE_DOCUMENT_BUCKET = 'patient-sources'
export const MAX_SOURCE_FILE_BYTES = 25 * 1024 * 1024

export type SourceDocumentKind = 'file' | 'manual_text'

export interface SourceDocumentRecord {
  id: string
  ownerId: string
  sourceKind: SourceDocumentKind
  storagePath: string | null
  originalFilename: string
  mimeType: string
  sizeBytes: number
  sha256: string
  itemType: HealthItemType
  uploadItemId: string
  sourceRecordId: string
  title: string
  summary: string
  facility: string
  eventDate: string
  extractionStatus: 'processed' | 'failed'
  extractionModel: string
  pageCount: number | null
  selectedPages: number[]
  createdAt: string
  updatedAt: string
}

interface CreateSourceDocumentInput {
  userId: string
  file: File | null
  manualText: string
  itemType: HealthItemType
  extraction: HealthExtraction
  uploadItemId: string
  sourceRecordId: string
}

interface SourceDocumentRow {
  id: string
  owner_id: string
  source_kind: SourceDocumentKind
  storage_path: string | null
  original_filename: string
  mime_type: string
  size_bytes: number
  sha256: string
  item_type: HealthItemType
  upload_item_id: string
  source_record_id: string
  title: string
  summary: string
  facility: string
  event_date: string
  extraction_status: 'processed' | 'failed'
  extraction_model: string
  page_count: number | null
  selected_pages: number[] | null
  created_at: string
  updated_at: string
}

const selectedColumns = 'id,owner_id,source_kind,storage_path,original_filename,mime_type,size_bytes,sha256,item_type,upload_item_id,source_record_id,title,summary,facility,event_date,extraction_status,extraction_model,page_count,selected_pages,created_at,updated_at'

function rowToDocument(row: SourceDocumentRow): SourceDocumentRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sourceKind: row.source_kind,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    itemType: row.item_type,
    uploadItemId: row.upload_item_id,
    sourceRecordId: row.source_record_id,
    title: row.title,
    summary: row.summary,
    facility: row.facility,
    eventDate: row.event_date,
    extractionStatus: row.extraction_status,
    extractionModel: row.extraction_model,
    pageCount: row.page_count,
    selectedPages: Array.isArray(row.selected_pages) ? row.selected_pages : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sourceDocumentError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message || 'The source document could not be saved.'
  if (error?.code === '42P01' || /relation .*source_documents.* does not exist/i.test(message)) {
    return new Error('Supabase is connected, but private source storage is not installed. Run the latest supabase/schema.sql in the Supabase SQL Editor.')
  }
  if (/bucket not found/i.test(message)) {
    return new Error('The private patient-sources bucket is missing. Run the latest supabase/schema.sql in the Supabase SQL Editor.')
  }
  if (/row-level security|violates.*policy|unauthorized/i.test(message)) {
    return new Error('Supabase blocked this source through its ownership policies. Confirm the latest schema is installed and that you are signed in.')
  }
  return new Error(message)
}

function safeFilename(value: string) {
  const cleaned = value.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '')
  return cleaned.slice(0, 120) || 'health-source'
}

function randomId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

async function sha256Hex(value: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await value.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function createSourceDocument(input: CreateSourceDocumentInput): Promise<SourceDocumentRecord> {
  if (!supabase) throw new Error('Cloud source storage is not configured.')
  const manualText = input.manualText.trim()
  if (!input.file && !manualText) throw new Error('Add a file or source text before saving.')
  if (input.file && input.file.size > MAX_SOURCE_FILE_BYTES) throw new Error('Source files must be 25 MB or smaller.')

  const routed = routeHealthExtraction(input.extraction, input.itemType, input.file?.name.replace(/\.[^.]+$/, ''))
  const extraction = routed.extraction
  const id = randomId()
  const sourceKind: SourceDocumentKind = input.file ? 'file' : 'manual_text'
  const originalFilename = input.file?.name || `${safeFilename(extraction.title)}.txt`
  const mimeType = input.file?.type || 'text/plain'
  const sourceBlob = input.file || new Blob([manualText], { type: mimeType })
  const checksum = await sha256Hex(sourceBlob)
  const storagePath = input.file ? `${input.userId}/${id}/${safeFilename(originalFilename)}` : null

  if (input.file && storagePath) {
    const { error } = await supabase.storage.from(SOURCE_DOCUMENT_BUCKET).upload(storagePath, input.file, {
      cacheControl: '3600',
      contentType: mimeType || undefined,
      upsert: false,
    })
    if (error) throw sourceDocumentError(error)
  }

  const { data, error } = await supabase.from('source_documents').insert({
    id,
    owner_id: input.userId,
    source_kind: sourceKind,
    storage_path: storagePath,
    original_filename: originalFilename,
    mime_type: mimeType,
    size_bytes: sourceBlob.size,
    sha256: checksum,
    item_type: routed.type,
    upload_item_id: input.uploadItemId,
    source_record_id: input.sourceRecordId,
    title: extraction.title,
    summary: extraction.summary,
    facility: extraction.facility || '',
    event_date: extraction.event_date || '',
    source_text: sourceKind === 'manual_text' ? manualText : null,
    extraction_status: 'processed',
    extraction_model: extraction.model || (extraction.mode === 'demo' ? 'Synthetic demo' : 'Unknown model'),
    extraction,
    page_count: extraction.page_count || null,
    selected_pages: extraction.source_pages || [],
  }).select(selectedColumns).single()

  if (error) {
    if (storagePath) await supabase.storage.from(SOURCE_DOCUMENT_BUCKET).remove([storagePath]).catch(() => undefined)
    throw sourceDocumentError(error)
  }
  return rowToDocument(data as SourceDocumentRow)
}

export async function listSourceDocuments(userId: string): Promise<SourceDocumentRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('source_documents')
    .select(selectedColumns)
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw sourceDocumentError(error)
  return ((data || []) as SourceDocumentRow[]).map(rowToDocument)
}

export async function createSourceDocumentUrl(document: SourceDocumentRecord, expiresInSeconds = 300) {
  if (!supabase || !document.storagePath) return null
  const { data, error } = await supabase.storage.from(SOURCE_DOCUMENT_BUCKET).createSignedUrl(document.storagePath, expiresInSeconds)
  if (error) throw sourceDocumentError(error)
  return data.signedUrl
}

export async function deleteSourceDocument(userId: string, document: SourceDocumentRecord) {
  if (!supabase) throw new Error('Cloud source storage is not configured.')
  if (document.storagePath) {
    const { error: storageError } = await supabase.storage.from(SOURCE_DOCUMENT_BUCKET).remove([document.storagePath])
    if (storageError && !/not found/i.test(storageError.message)) throw sourceDocumentError(storageError)
  }
  const { error } = await supabase.from('source_documents').delete().eq('id', document.id).eq('owner_id', userId)
  if (error) throw sourceDocumentError(error)
}
