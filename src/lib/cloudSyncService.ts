import type { SupabaseClient } from '@supabase/supabase-js'
import {
  CLOUD_BUNDLE_SCHEMA_VERSION,
  normalizeCloudRecord,
  type PatientCloudBundle,
} from './cloudBundle'

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
  const { error } = await client.from('patient_records').delete().eq('user_id', userId)
  if (error) throw new Error(cloudErrorMessage(error))
}
