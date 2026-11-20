// Legacy-mode smoke test: with no proxy reachable (/ui-config.json fails)
// auth.ts falls back to single-tenant mode, initAuth() resolves true and the
// shell renders. Non-admin whoami must not reveal the admin tabs.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/ui-config.json') throw new TypeError('network down (no proxy)')
    if (url.includes('/api/auth/whoami')) {
      return json({ user_id: 'my-user', role: 'user', via: 'legacy', label: 'me', shared_tenant: 'shared' })
    }
    if (url.includes('/api/stats')) {
      return json({ total: 0, by_agent: {}, by_category: {}, by_tag: {} })
    }
    if (url.includes('/api/memories')) return json([])
    return json({})
  }))
})

describe('App in legacy mode', () => {
  it('renders the header and hides admin tabs for a plain user', async () => {
    render(<App />)
    expect(await screen.findByText('claude-memory')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Memories' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'My tokens' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Jobs' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Users' })).toBeNull()
  })
})
