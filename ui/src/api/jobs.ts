import { request } from './http'

export interface JobRun {
  id: string
  started_at: string
  finished_at: string | null
  phase: string
  status: 'running' | 'completed' | 'failed'
  memories_scanned: number
  memories_changed: number
  rules_added: number
  duration_seconds: number | null
  error: string | null
  /** line-by-line report (checkpoint promotion) */
  details?: string | null
}

export const jobsApi = {
  list: (): Promise<JobRun[]> => request('/api/jobs'),
  get: (id: string): Promise<JobRun> => request(`/api/jobs/${id}`),
}
