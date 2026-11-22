// Space filter (bean o9y4): All / Mine / Shared is visible to every user,
// feeds ?space= into the list AND stats queries, defaults to All (no param,
// byte-identical to before) and persists per browser session (sessionStorage).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Memories from './Memories'

const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

let urls: string[] = []

function mockFetch(role = 'user') {
  urls = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/api/auth/whoami')) {
      return json({
        user_id: 'my-user', role, via: 'token', label: 'me', shared_tenant: 'global',
      })
    }
    if (url.includes('/api/stats')) {
      return json({ total: 0, by_agent: {}, by_category: {}, by_tag: {} })
    }
    if (url.includes('/api/users')) return json([])
    if (url.includes('/api/memories')) return json([])
    return json({})
  }))
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Memories />
    </QueryClientProvider>,
  )
}

const memoryUrls = () => urls.filter(u => u.includes('/api/memories') && !u.includes('export'))
const statsUrls = () => urls.filter(u => u.includes('/api/stats'))

beforeEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('space filter (o9y4)', () => {
  it('is visible to a plain user and defaults to All (no space param)', async () => {
    mockFetch()
    renderPage()
    expect(await screen.findByRole('group', { name: 'Space filter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mine' })).toBeInTheDocument()
    // wait for the first queries, then check no space param leaked in
    await screen.findByText(/0 memories/)
    expect(memoryUrls().length).toBeGreaterThan(0)
    expect(memoryUrls().every(u => !u.includes('space='))).toBe(true)
    expect(statsUrls().every(u => !u.includes('space='))).toBe(true)
  })

  it('sends space=shared on list AND stats when Shared is picked', async () => {
    mockFetch()
    renderPage()
    await screen.findByText(/0 memories/)
    await userEvent.click(screen.getByRole('button', { name: 'Shared' }))
    await vi.waitFor(() => {
      expect(memoryUrls().some(u => u.includes('space=shared'))).toBe(true)
      expect(statsUrls().some(u => u.includes('space=shared'))).toBe(true)
    })
    expect(sessionStorage.getItem('cm.space-filter')).toBe('shared')
  })

  it('restores the choice from sessionStorage on a fresh mount', async () => {
    mockFetch()
    sessionStorage.setItem('cm.space-filter', 'own')
    renderPage()
    await vi.waitFor(() => {
      expect(memoryUrls().some(u => u.includes('space=own'))).toBe(true)
    })
    expect(screen.getByRole('button', { name: 'Mine' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
