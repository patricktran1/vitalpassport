import { supabase } from './supabase'
import type { ShareLinkRecord, SharedBriefEnvelope, SharedBriefPacket } from '../types'

const TOKEN_VAULT_KEY = 'vital-share-token-vault'

interface ShareRow {
  id: string
  label: string
  created_at: string
  expires_at: string
  revoked_at: string | null
  last_accessed_at: string | null
  access_count: number
}

function base64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function readVault(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(TOKEN_VAULT_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function saveToken(id: string, token: string) {
  const vault = readVault()
  vault[id] = token
  window.localStorage.setItem(TOKEN_VAULT_KEY, JSON.stringify(vault))
}

function forgetToken(id: string) {
  const vault = readVault()
  delete vault[id]
  window.localStorage.setItem(TOKEN_VAULT_KEY, JSON.stringify(vault))
}

function rowToRecord(row: ShareRow): ShareLinkRecord {
  const token = readVault()[row.id]
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastAccessedAt: row.last_accessed_at,
    accessCount: row.access_count,
    token,
    url: token ? `${window.location.origin}/s/${token}` : undefined,
  }
}

export async function createShareLink(ownerId: string, packet: SharedBriefPacket, hours: number, label: string) {
  if (!supabase) throw new Error('Cloud sharing is not configured.')
  const token = generateToken()
  const tokenHash = await sha256Hex(token)
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('shared_briefs')
    .insert({
      owner_id: ownerId,
      token_hash: tokenHash,
      packet,
      label: label.trim() || 'Clinician brief',
      expires_at: expiresAt,
    })
    .select('id,label,created_at,expires_at,revoked_at,last_accessed_at,access_count')
    .single()

  if (error) throw error
  const row = data as ShareRow
  saveToken(row.id, token)
  return rowToRecord(row)
}

export async function listShareLinks(ownerId: string) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('shared_briefs')
    .select('id,label,created_at,expires_at,revoked_at,last_accessed_at,access_count')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return ((data || []) as ShareRow[]).map(rowToRecord)
}

export async function revokeShareLink(ownerId: string, id: string) {
  if (!supabase) throw new Error('Cloud sharing is not configured.')
  const { error } = await supabase
    .from('shared_briefs')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId)
  if (error) throw error
  forgetToken(id)
}

export async function fetchSharedBrief(token: string): Promise<SharedBriefEnvelope | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_shared_brief', { p_token: token })
  if (error) throw error
  if (!data || typeof data !== 'object') return null
  const payload = data as Record<string, unknown>
  if (!payload.packet || typeof payload.packet !== 'object') return null
  return {
    packet: payload.packet as SharedBriefPacket,
    createdAt: typeof payload.created_at === 'string' ? payload.created_at : '',
    expiresAt: typeof payload.expires_at === 'string' ? payload.expires_at : '',
    accessCount: typeof payload.access_count === 'number' ? payload.access_count : 0,
  }
}

export function demoShareUrl() {
  return `${window.location.origin}/s/demo-maria`
}
