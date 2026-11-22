// Share-to-all (bean vd3y): the button appears for admins only and only on
// rows not already shared; it confirms first, then PATCHes /share; the
// refetched row carries the shared chip; a failed share surfaces a toast.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Memories from './Memories'

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const memory = (tenant: string) => ({
  id: 'm-1',
  memory: 'a fact worth sharing',
  agent_id: 'claude',
  tenant,
  category: 'project',
  tags: [],
  created_at: '2026-11-22T00:00:00Z',
  updated_at: '2026-11-22T00:00:00Z',
  score: null,
})

let memories: unknown[] = []
const calls: string[] = []

function mockFetch(opts: { role: string; shareStatus?: number }) {
  memories = [memory(opts.role === 'admin' ? 'my-user' : 'someone')]
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/auth/whoami')) {
      return json({
        user_id: 'my-user', role: opts.role, via: 'token', label: 'me',
        shared_tenant: 'global',
      })
    }
    if (url.includes('/api/stats')) {
      return json({ total: 1, by_agent: { claude: 1 }, by_category: { project: 1 }, by_tag: {} })
    }
    if (url.includes('/api/users')) return json([])
    if (url.includes('/share')) {
      calls.push(`PATCH ${url}`)
      if (opts.shareStatus && opts.shareStatus !== 200) {
        return json({ ok: false, error: 'nope' }, opts.shareStatus)
      }
      memories = [memory('global')] // the move: same id, shared tenant now
      return json({ ok: true, shared: true, already_shared: false })
    }
    if (url.includes('/api/memories')) return json(memories)
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

beforeEach(() => {
  cleanup()
  calls.length = 0
  vi.unstubAllGlobals()
})

describe('share to all (admin)', () => {
  it('confirms, moves the row to the shared space and shows the chip', async () => {
    mockFetch({ role: 'admin' })
    renderPage()
    const btn = await screen.findByRole('button', { name: /^Share to all —/ })
    await userEvent.click(btn)
    // confirm dialog first — nothing sent yet
    expect(await screen.findByText('Share to all?')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Share to all' }))
    expect(await screen.findByText('shared', { exact: true })).toBeInTheDocument()
    expect(calls).toEqual(['PATCH /api/memories/m-1/share'])
    // the moved row offers no share button anymore (it is shared now)
    expect(screen.queryByRole('button', { name: /^Share to all —/ })).toBeNull()
  })

  it('shows an error toast when the server refuses', async () => {
    mockFetch({ role: 'admin', shareStatus: 403 })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: /^Share to all —/ }))
    await screen.findByText('Share to all?')
    fireEvent.click(screen.getByRole('button', { name: 'Share to all' }))
    expect(await screen.findByText(/Share failed: 403/)).toBeInTheDocument()
  })

  it('offers no share button to non-admins', async () => {
    mockFetch({ role: 'user' })
    renderPage()
    expect(await screen.findByText('a fact worth sharing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Share to all —/ })).toBeNull()
  })
})
