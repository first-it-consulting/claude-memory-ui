// Share proposals (server bean oi38): owners propose their own memories for
// the shared space; admins review them here. The approve call can come back
// 409 'changed since proposal' when the owner edited the content after
// proposing - the UI must surface that verbatim, never approve silently.
import { request } from './http'

export interface Proposal {
  id: string
  memory: string
  tenant: string
  share_status: 'proposed' | 'rejected' | string
  proposed_by: string
  proposed_at: string
  updated_at: string
  rejected_by: string
  rejected_at: string
  rejected_reason: string
}

export const proposalsApi = {
  /** owner: mark their own memory as a proposal (429 beyond 20 open) */
  propose: (id: string): Promise<{ ok: boolean; proposed: boolean; already_proposed: boolean }> =>
    request(`/api/memories/${id}/propose-share`, { method: 'POST' }),

  /** owner: pull an open proposal back */
  withdraw: (id: string): Promise<{ ok: boolean; withdrawn: boolean }> =>
    request(`/api/memories/${id}/withdraw-share`, { method: 'POST' }),

  /** admin worklist: proposed (default) | rejected | all */
  list: (status: 'proposed' | 'rejected' | 'all' = 'proposed'): Promise<Proposal[]> =>
    request(`/api/share-proposals?status=${status}`),

  /** admin: move it into the shared space (audit recorded server-side) */
  approve: (id: string): Promise<{ ok: boolean; shared: boolean; already_shared: boolean }> =>
    request(`/api/share-proposals/${id}/approve`, { method: 'POST' }),

  /** admin: decline with an optional reason the owner sees as a chip */
  reject: (id: string, reason: string): Promise<{ ok: boolean; rejected: boolean }> =>
    request(`/api/share-proposals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
}
