// Per-user API tokens (PATs). Plaintext appears exactly once, in the create
// response — the server stores only a hash, so a lost token means a new one.
import { request } from './http'

export interface TokenRow {
  id: string
  user_id: string
  name: string
  display: string          // "cm_t1a2b3c4…abcd" — prefix + last4, never more
  can_admin: boolean
  default_harness: string
  created_at: string
  created_by: string
  expires_at: string | null
  expires_in_days: number | null   // null = never expires or revoked
  last_used_at: string | null
  revoked_at: string | null
  revoked_by: string
}

export interface CreateTokenResult {
  ok: boolean
  id: string
  token: string            // the only place the plaintext exists client-side
  expires_days: number
  expires_at: string
  can_admin: boolean
  warning: string
  note?: string
}

export interface CreateTokenBody {
  name: string
  expires_days: number
  default_harness?: string
  can_admin?: boolean
}

export type TokenStatus = 'active' | 'expiring' | 'expired' | 'revoked'

export function statusOf(t: TokenRow): TokenStatus {
  if (t.revoked_at) return 'revoked'
  if (t.expires_at && new Date(t.expires_at).getTime() <= Date.now()) return 'expired'
  if (t.expires_in_days !== null && t.expires_in_days < 14) return 'expiring'
  return 'active'
}

export const tokensApi = {
  mine: (): Promise<{ tokens: TokenRow[] }> => request('/api/me/tokens'),

  create: (body: CreateTokenBody): Promise<CreateTokenResult> =>
    request('/api/me/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  revoke: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/me/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  adminList: (user?: string): Promise<{ tokens: TokenRow[] }> =>
    request('/api/admin/tokens' + (user ? `?user=${encodeURIComponent(user)}` : '')),

  adminRevoke: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/admin/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
