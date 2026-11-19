import { request } from './http'

export interface User {
  id: string
  name: string
  role: 'user' | 'admin'
  oidc_sub: string | null
  email: string
  disabled: boolean
  created_at: string
  last_login_at: string | null
}

export const usersApi = {
  list: (): Promise<User[]> => request('/api/users'),

  create: (id: string, name: string, role: string): Promise<{ ok: boolean; user: User; token: string }> =>
    request('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, role }),
    }),

  update: (id: string, patch: Partial<Pick<User, 'name' | 'role' | 'disabled'>>): Promise<{ ok: boolean; user: User }> =>
    request(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),

  rotateToken: (id: string): Promise<{ ok: boolean; token: string }> =>
    request(`/api/users/${encodeURIComponent(id)}/rotate-token`, { method: 'POST' }),

  remove: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
