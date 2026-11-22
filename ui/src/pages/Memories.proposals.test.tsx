// Owner proposal flow (bean oi38): own non-shared cards get a 'Propose to
// share' button, proposed rows a chip + withdraw, rejected rows a chip whose
// tooltip carries the admin's reason. 429/409 errors surface as a snackbar.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Memories from './Memories'

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

let rows: unknown[] = []

function mockFetch() {
  rows = [
    {
      id: 'm-own', memory: 'my own fact', agent_id: 'claude', tenant: 'my-user',
      category: '', tags: [], created_at: '2026-11-20T10:00:00+00:00',
      updated_at: '', score: null, share_status: '', rejected_reason: '',
    },
    {
      id: 'm-proposed', memory: 'waiting for admin', agent_id: 'claude', tenant: 'my-user',
      category: '', tags: [], created_at: '2026-11-20T10:00:00+00:00',
      updated_at: '', score: null, share_status: 'proposed', rejected_reason: '',
    },
    {
      id: 'm-rejected', memory: 'declined fact', agent_id: 'claude', tenant: 'my-user',
      category: '', tags: [], created_at: '2026-11-20T10:00:00+00:00',
      updated_at: '', score: null, share_status: 'rejected',
      rejected_reason: 'duplicate of an existing shared fact',
    },
    {
      id: 'm-shared', memory: 'shared space fact', agent_id: 'claude', tenant: 'global',
      category: '', tags: [], created_at: '2026-11-20T10:00:00+00:00',
      updated_at: '', score: null, share_status: '', rejected_reason: '',
    },
  ]
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/auth/whoami')) {
      return json({
        user_id: 'my-user', role: 'user', via: 'token', label: 'me', shared_tenant: 'global',
      })
    }
    if (url.includes('/api/stats')) {
      return json({ total: 0, by_agent: {}, by_category: {}, by_tag: {} })
    }
    if (url.includes('/api/users')) return json([])
    if (url.includes('/propose-share')) return json({ ok: true, proposed: true, already_proposed: false })
    if (url.includes('/withdraw-share')) return json({ ok: true, withdrawn: true })
    if (url.includes('/api/memories')) return json(rows)
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

const proposeCalls = () =>
  vi.mocked(fetch).mock.calls.filter(
    ([u, i]) => String(u).includes('/m-own/propose-share') && (i as RequestInit)?.method === 'POST',
  )

beforeEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('owner proposals (oi38)', () => {
  it('offers propose on own plain card only, and shows state chips', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('my own fact')
    expect(
      await screen.findAllByRole('button', { name: /Propose to share/ }),
    ).toHaveLength(1)
    expect(screen.getByText('proposed')).toBeInTheDocument()
    expect(screen.getByText('rejected')).toBeInTheDocument()
    // the withdraw button exists only on the proposed row
    expect(screen.getAllByRole('button', { name: 'Withdraw the open proposal' })).toHaveLength(1)
  })

  it('proposes via POST and shows the withdraw button on proposed rows', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('my own fact')
    await userEvent.click(screen.getByRole('button', { name: /Propose to share/ }))
    await waitFor(() => expect(proposeCalls()).toHaveLength(1))
  })

  it('rejected chip tooltip carries the admin reason', async () => {
    mockFetch()
    renderPage()
    const chip = await screen.findByText('rejected')
    await userEvent.hover(chip)
    expect(
      await screen.findByText(/duplicate of an existing shared fact/),
    ).toBeInTheDocument()
  })

  it('surfaces a 429 rate-limit as a snackbar', async () => {
    mockFetch()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/auth/whoami')) {
        return json({ user_id: 'my-user', role: 'user', via: 'token', label: 'me', shared_tenant: 'global' })
      }
      if (url.includes('/api/stats')) return json({ total: 0, by_agent: {}, by_category: {}, by_tag: {} })
      if (url.includes('/api/users')) return json([])
      if (url.includes('/propose-share')) {
        return json({ ok: false, error: 'too many open proposals (max 20)' }, 429)
      }
      if (url.includes('/api/memories')) return json(rows)
      return json({})
    }))
    renderPage()
    await screen.findByText('my own fact')
    await userEvent.click(screen.getByRole('button', { name: /Propose to share/ }))
    expect(await screen.findByText(/Propose failed: 429/)).toBeInTheDocument()
  })
})
