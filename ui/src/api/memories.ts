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
}

function qs(params: FetchParams): string {
  const qs = new URLSearchParams()
  for (const k of ['q', 'sort', 'agent_id', 'category', 'tag', 'scope', 'tenant'] as const) {
    const v = params[k]
    if (v) qs.set(k, v)
  }
  return qs.size ? `?${qs}` : ''
}

export const api = {
  stats: (params: FetchParams = {}): Promise<Stats> =>
    request(`/api/stats${qs(params)}`),

  list: (params: FetchParams = {}): Promise<Memory[]> =>
    request(`/api/memories${qs(params)}`),

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

  exportPath: (params: FetchParams = {}): string => `/api/memories/export${qs(params)}`,
}
