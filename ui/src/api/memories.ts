import { request } from './http'

export type MemoryCategory = 'project' | 'feedback' | 'reference' | 'user' | 'session' | 'incident' | ''

export interface Memory {
  id: string
  memory: string
  agent_id: string
  tenant: string
  category: MemoryCategory
  tags: string[]
  created_at: string
  updated_at: string
  score: number | null
  /** proposal state (server bean oi38): '' | 'proposed' | 'rejected' —
   *  only meaningful on the owner's own rows */
  share_status?: string
  rejected_reason?: string
}

export interface Stats {
  total: number
  first_added: string | null
  last_added: string | null
  by_agent: Record<string, number>
  by_category: Record<string, number>
  by_tag: Record<string, number>
  tagged?: number
}

export interface FetchParams {
  q?: string
  sort?: 'newest' | 'oldest' | 'relevance'
  agent_id?: string
  category?: string
  tag?: string
  /** admin workspace scope */
  scope?: 'all'
  tenant?: string
  /** space filter (bean o9y4): own = no shared rows, shared = only them;
   *  omitted = the default union 'own + shared' */
  space?: 'own' | 'shared'
  /** paging (bean pj1k): with these the server answers
   *  {memories, total} instead of a plain array */
  limit?: number
  offset?: number
}

function qs(params: FetchParams): string {
  const qs = new URLSearchParams()
  for (const k of ['q', 'sort', 'agent_id', 'category', 'tag', 'scope', 'tenant', 'space'] as const) {
    const v = params[k]
    if (v) qs.set(k, v)
  }
  for (const k of ['limit', 'offset'] as const) {
    const v = params[k]
    if (v !== undefined) qs.set(k, String(v))
  }
  return qs.size ? `?${qs}` : ''
}

export const api = {
  stats: (params: FetchParams = {}): Promise<Stats> =>
    request(`/api/stats${qs(params)}`),

  list: (params: FetchParams = {}): Promise<Memory[]> =>
    request(`/api/memories${qs(params)}`),

  /** paged list (bean pj1k): limit/offset make the server answer
   *  {memories, total}; tolerant of a plain-array answer (older server,
   *  or a mock) so a newer UI never breaks against it */
  listPaged: async (params: FetchParams): Promise<{ memories: Memory[]; total: number }> => {
    const raw = await request<Memory[] | { memories: Memory[]; total: number }>(
      `/api/memories${qs(params)}`,
    )
    if (Array.isArray(raw)) return { memories: raw, total: raw.length }
    return { memories: raw.memories ?? [], total: raw.total ?? 0 }
  },

  add: (content: string, shared = false): Promise<{ ok: boolean }> =>
    request('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, shared }),
    }),

  update: (id: string, content: string): Promise<{ ok: boolean }> =>
    request(`/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memory: content }),
    }),

  updateTags: (id: string, tags: string[]): Promise<{ ok: boolean }> =>
    request(`/api/memories/${id}/tags`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    }),

  delete: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/memories/${id}`, { method: 'DELETE' }),

  /** Admin-only MOVE of an existing memory into the shared space, keeping
   *  its id (server bean vd3y). Idempotent: already_shared=true on a
   *  second call. 403 non-admin, 404 unknown id, 503 store unreachable. */
  share: (id: string): Promise<{ ok: boolean; shared: boolean; already_shared: boolean }> =>
    request(`/api/memories/${id}/share`, { method: 'PATCH' }),

  exportPath: (params: FetchParams = {}): string => `/api/memories/export${qs(params)}`,
}
