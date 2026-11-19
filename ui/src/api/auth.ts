import { request } from './http'

export interface Whoami {
  user_id: string
  role: 'user' | 'admin'
  via: string
  label: string
  shared_tenant: string
}

export const authApi = {
  whoami: (): Promise<Whoami> => request('/api/auth/whoami'),
}
