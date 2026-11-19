// Session checkpoints (working memory of Claude Code / Codex / pi sessions).
// Served under /ui-api/* by the UI backend: the ingress routes /api/sessions
// straight to the server for the harness adapters (bearer token required).

import { request } from './http'

export interface Session {
  session_id: string
  owner: string
  project: string
  harness: string
  state: string
  auto_notes: string
  created_at: string
  updated_at: string
}

export interface SessionParams {
  project?: string
  harness?: string
  limit?: number
  /** admin workspace scope */
  scope?: 'all'
  tenant?: string
}

export const sessionsApi = {
  list: (params: SessionParams = {}): Promise<Session[]> => {
    const qs = new URLSearchParams()
    if (params.project) qs.set('project', params.project)
    if (params.harness) qs.set('harness', params.harness)
    if (params.scope) qs.set('scope', params.scope)
    if (params.tenant) qs.set('tenant', params.tenant)
    qs.set('limit', String(params.limit ?? 100))
    return request(`/ui-api/sessions?${qs}`)
  },

  remove: (id: string, scope: { scope?: string; tenant?: string } = {}): Promise<{ ok: boolean }> => {
    const qs = new URLSearchParams()
    if (scope.scope) qs.set('scope', scope.scope)
    if (scope.tenant) qs.set('tenant', scope.tenant)
    const suffix = qs.size ? `?${qs}` : ''
    return request(`/ui-api/sessions/${encodeURIComponent(id)}${suffix}`, { method: 'DELETE' })
  },
}

/** First line of the "## Goal" section, or the first non-empty line.
 *  Auto-captured notes: the most recent user request. */
export function goalOf(s: Session): string {
  if (!s.state && s.auto_notes) {
    const requests = s.auto_notes.split('\n').map(l => l.trim()).filter(l => l.startsWith('- '))
    return requests.length ? requests[requests.length - 1].slice(2) : ''
  }
  const lines = (s.state || '').split('\n').map(l => l.trim())
  const i = lines.findIndex(l => /^#+\s*goal\b/i.test(l))
  if (i >= 0) {
    const next = lines.slice(i + 1).find(l => l && !l.startsWith('#'))
    if (next) return next
  }
  return lines.find(l => l && !l.startsWith('#')) ?? ''
}
