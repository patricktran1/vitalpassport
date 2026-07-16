import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CLOUD_BUNDLE_SCHEMA_VERSION,
  normalizeCloudRecord,
  type PatientCloudBundle,
} from './cloudBundle'
import { SOURCE_DOCUMENT_BUCKET } from './sourceDocuments'

export interface CloudRecordResult {
  bundle: PatientCloudBundle | null
  updatedAt: string | null
}

export function cloudErrorMessage(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message || 'The cloud record could not be synchronized.'
  if (error?.code === '42P01' || /relation .*patient_records.* does not exist/i.test(message)) {
    return 'Supabase is connected, but the Vital Passport database schema is missing. Run supabase/schema.sql in the Supabase SQL Editor.'
  }
  if (/row-level security|violates.*policy/i.test(message)) {
    return 'Supabase rejected the record through Row Level Security. Confirm that supabase/schema.sql was run and that you are signed in.'
  }
  return message
}

function missingRelation(error: { message?: string; code?: string } | null | undefined) {
  return error?.code === '42P01' || /relation .* does not exist/i.test(error?.message || '')
}

export async function loadCloudBundle(client: SupabaseClient, userId: string): Promise<CloudRecordResult> {
  const { data, error } = await client
    .from('patient_records')
    .select('record, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(cloudErrorMessage(error))
  return {
    bundle: normalizeCloudRecord(data?.record),
    updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : null,
  }
}

export async function saveCloudBundle(client: SupabaseClient, userId: string, bundle: PatientCloudBundle) {
  const syncedAt = new Date().toISOString()
  const storedBundle: PatientCloudBundle = {
    ...bundle,
    updatedAt: syncedAt,
    coreRecord: { ...bundle.coreRecord, updatedAt: syncedAt },
  }
  const { error } = await client.from('patient_records').upsert({
    user_id: userId,
    record: storedBundle,
    schema_version: CLOUD_BUNDLE_SCHEMA_VERSION,
    updated_at: syncedAt,
  }, { onConflict: 'user_id' })

  if (error) throw new Error(cloudErrorMessage(error))
  return syncedAt
}

export async function deleteCloudBundle(client: SupabaseClient, userId: string) {
  const { data: sourceRows, error: sourceListError } = await client
    .from('source_documents')
    .select('storage_path')
    .eq('owner_id', userId)

  if (sourceListError && !missingRelation(sourceListError)) throw new Error(cloudErrorMessage(sourceListError))

  const storagePaths = (sourceRows || [])
    .map((row) => typeof row.storage_path === 'string' ? row.storage_path : '')
    .filter(Boolean)

  if (storagePaths.length) {
    const { error: storageError } = await client.storage.from(SOURCE_DOCUMENT_BUCKET).remove(storagePaths)
    if (storageError && !/bucket not found|not found/i.test(storageError.message)) throw new Error(cloudErrorMessage(storageError))
  }

  if (!sourceListError) {
    const { error: sourceDeleteError } = await client.from('source_documents').delete().eq('owner_id', userId)
    if (sourceDeleteError) throw new Error(cloudErrorMessage(sourceDeleteError))
  }

  const { error: shareDeleteError } = await client.from('shared_briefs').delete().eq('owner_id', userId)
  if (shareDeleteError && !missingRelation(shareDeleteError)) throw new Error(cloudErrorMessage(shareDeleteError))

  const { error } = await client.from('patient_records').delete().eq('user_id', userId)
  if (error) throw new Error(cloudErrorMessage(error))
}
