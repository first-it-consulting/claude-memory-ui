// Paging (bean pj1k): the Memories page requests 50 per page, shows
// "N of TOTAL", walks pages with "Load more" (no infinite scroll), hides
// the button at the end of the filtered set, and restarts at offset 0
// when a filter changes.
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
let serverTotal = 120

function memoryRow(i: number) {
  return {
    id: `m-${i}`,
    memory: `paged fact ${i}`,
    agent_id: 'claude',
    tenant: 'my-user',
    category: '',
    tags: [],
    created_at: '2026-11-22T10:00:00+00:00',
    updated_at: '',
    score: null,
    share_status: '',
    rejected_reason: '',
  }
}

function mockFetch() {
  urls = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/api/auth/whoami')) {
      return json({
        user_id: 'my-user', role: 'user', via: 'token', label: 'me', shared_tenant: 'global',
      })
    }
    if (url.includes('/api/stats')) {
      return json({ total: serverTotal, by_agent: { claude: serverTotal }, by_category: {}, by_tag: {} })
    }
    if (url.includes('/api/memories') && !url.includes('export')) {
      const u = new URL(url, 'http://localhost')
      const offset = Number(u.searchParams.get('offset') ?? '0')
      const limit = Number(u.searchParams.get('limit') ?? String(serverTotal))
      const end = Math.min(offset + limit, serverTotal)
      const memories = offset >= serverTotal ? [] : Array.from({ length: end - offset }, (_, k) => memoryRow(offset + k))
      return json({ memories, total: serverTotal })
    }
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

beforeEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
  serverTotal = 120
})

describe('paging (pj1k)', () => {
  it('asks for 50 with offset 0 and shows N of TOTAL plus Load more', async () => {
    mockFetch()
    renderPage()
    expect(await screen.findByText('50 of 120 memories')).toBeInTheDocument()
    expect(memoryUrls()[0]).toContain('limit=50')
    expect(memoryUrls()[0]).toContain('offset=0')
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()
  })

  it('Load more fetches offset 50 and the counter grows', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('50 of 120 memories')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('100 of 120 memories')).toBeInTheDocument()
    expect(memoryUrls().some(u => u.includes('offset=50'))).toBe(true)
  })

  it('button disappears when the last page is loaded', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('50 of 120 memories')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('100 of 120 memories')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByText('120 of 120 memories')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('no button at all when everything fits in one page', async () => {
    serverTotal = 12
    mockFetch()
    renderPage()
    expect(await screen.findByText('12 of 12 memories')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('changing the space filter restarts paging at offset 0', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('50 of 120 memories')
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByText('100 of 120 memories')
    urls = []
    await userEvent.click(screen.getByRole('button', { name: 'Mine' }))
    expect(await screen.findByText('50 of 120 memories')).toBeInTheDocument()
    const fresh = memoryUrls()
    expect(fresh.length).toBeGreaterThan(0)
    // the refetch starts a new window: no offset beyond 0 for the new filter
    expect(fresh.every(u => u.includes('offset=0'))).toBe(true)
    expect(fresh.every(u => u.includes('space=own'))).toBe(true)
  })
})
