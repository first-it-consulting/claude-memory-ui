import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { statusOf, TokenRow } from './tokens'

const NOW = '2026-01-15T12:00:00Z'

function mk(over: Partial<TokenRow> = {}): TokenRow {
  return {
    id: 't1', user_id: 'u1', name: 'dev', display: 'cm_abcd…1234',
    can_admin: false, default_harness: '', created_at: '2026-01-01T00:00:00Z',
    created_by: 'u1', expires_at: null, expires_in_days: null,
    last_used_at: null, revoked_at: null, revoked_by: '', ...over,
  }
}

describe('statusOf', () => {
  beforeEach(() => { vi.useFakeTimers({ now: new Date(NOW) }) })
  afterEach(() => { vi.useRealTimers() })

  it('revoked wins over everything else', () => {
    expect(statusOf(mk({ revoked_at: NOW, expires_at: '2026-02-01T00:00:00Z', expires_in_days: 100 })))
      .toBe('revoked')
  })

  it('past or exact-now expiry is expired', () => {
    expect(statusOf(mk({ expires_at: '2026-01-15T11:59:00Z', expires_in_days: 30 }))).toBe('expired')
    expect(statusOf(mk({ expires_at: NOW, expires_in_days: 30 }))).toBe('expired')
  })

  it('under 14 days left is expiring, 14 is still active', () => {
    const future = '2026-02-01T00:00:00Z'
    expect(statusOf(mk({ expires_at: future, expires_in_days: 13 }))).toBe('expiring')
    expect(statusOf(mk({ expires_at: future, expires_in_days: 14 }))).toBe('active')
  })

  it('never-expiring tokens are active', () => {
    expect(statusOf(mk())).toBe('active')
  })
})
