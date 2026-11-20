import { request } from './http'

export interface Whoami {
  user_id: string
  role: 'user' | 'admin'
  via: string
  label: string
  shared_tenant: string
  // PAT context (present when the request authenticated with an API token)
  token_name?: string
  token_expires_in_days?: number
  token_expiring_soon?: boolean
}

export const authApi = {
  whoami: (): Promise<Whoami> => request('/api/auth/whoami'),
}
