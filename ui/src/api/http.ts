// Shared authenticated fetch. Every module's requests go through here so the
// bearer token and the 401 -> re-login path live in one place.
import { authHeader, login } from '../auth'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string>) || {}),
    ...(await authHeader()),
  }
  const res = await fetch(path, { ...init, headers })
  if (res.status === 401) {
    login()
    throw new Error('401 Unauthorized — signing in…')
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

/** Fetch with auth and trigger a browser download (export links cannot send
 *  headers, so the blob has to go through fetch). */
export async function download(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = await authHeader()
  const res = await fetch(path, { headers })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
