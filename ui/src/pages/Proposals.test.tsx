// Admin proposals worklist (bean oi38): pending list with Approve / Reject
// (reason dialog), status filter feeds ?status=, and a 409 from approve —
// content edited after proposing — surfaces as 'Changed since proposal' and
// pins a warning chip on that row instead of silently approving.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Proposals from './Proposals'

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

let urls: string[] = []
let approveStatus = 200

const pending = [
  {
    id: 'p-1', memory: 'worth sharing', tenant: 'alice', share_status: 'proposed',
    proposed_by: 'alice', proposed_at: '2026-11-22T10:00:00+00:00', updated_at: '',
    rejected_by: '', rejected_at: '', rejected_reason: '',
  },
]

function mockFetch() {
  urls = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    urls.push(url)
    if (url.includes('/api/share-proposals') && (init?.method ?? 'GET') === 'POST') {
      if (url.includes('/approve')) {
        return json(
          approveStatus === 200
            ? { ok: true, shared: true, already_shared: false }
            : { ok: false, error: 'content changed since proposal - ask the owner to re-propose' },
          approveStatus,
        )
      }
      return json({ ok: true, rejected: true })
    }
    if (url.includes('/api/share-proposals')) return json(pending)
    return json({})
  }))
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Proposals />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  approveStatus = 200
})

describe('admin proposals tab (oi38)', () => {
  it('lists pending proposals with who/what/when and both actions', async () => {
    mockFetch()
    renderPage()
    expect(await screen.findByText('worth sharing')).toBeInTheDocument()
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(urls.some(u => u.includes('/api/share-proposals?status=proposed'))).toBe(true)
  })

  it('approves via POST', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('worth sharing')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(
        urls.some(u => u.includes('/api/share-proposals/p-1/approve')),
      ).toBe(true),
    )
  })

  it('rejects with a reason through the dialog', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('worth sharing')
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }))
    const reason = await screen.findByLabelText(/Reason \(shown to the owner\)/)
    fireEvent.change(reason, { target: { value: 'not useful' } })
    // MUI Dialog actions: pointer-events under userEvent -> fireEvent
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => {
      const call = vi.mocked(fetch).mock.calls.find(
        ([u, i]) => String(u).includes('/p-1/reject') && i,
      )
      expect(call).toBeDefined()
      expect(String((call as [unknown, RequestInit])[1].body)).toContain('not useful')
    })
  })

  it('409 on approve shows the re-propose message and a chip, no silent move', async () => {
    approveStatus = 409
    mockFetch()
    renderPage()
    await screen.findByText('worth sharing')
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(await screen.findByText(/Changed since proposal/)).toBeInTheDocument()
    expect(screen.getByText('changed since proposal')).toBeInTheDocument()
  })

  it('status filter switches the query', async () => {
    mockFetch()
    renderPage()
    await screen.findByText('worth sharing')
    await userEvent.click(screen.getByRole('button', { name: 'Rejected' }))
    await waitFor(() =>
      expect(urls.some(u => u.includes('/api/share-proposals?status=rejected'))).toBe(true),
    )
  })
})
