// The one-time reveal dialog must only close via its own button: Esc (and,
// via the same no-op onClose, the backdrop) never destroys the plaintext, and
// closing drops it from the DOM and the mutation cache.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Tokens from './Tokens'

const PLAIN = 'cm_TESTPLAINvalue0000'

const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/auth/whoami')) {
      return json({ user_id: 'my-user', role: 'user', via: 'legacy', label: 'me', shared_tenant: 'shared' })
    }
    if (url.includes('/api/me/tokens') && init?.method === 'POST') {
      return json({
        ok: true, id: 't1', token: PLAIN, expires_days: 90,
        expires_at: '2026-04-15T00:00:00Z', can_admin: false, warning: '',
      })
    }
    if (url.includes('/api/me/tokens')) return json({ tokens: [] })
    return json({})
  }))
})

function renderTokens() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <Tokens />
    </QueryClientProvider>,
  )
}

describe('Tokens reveal dialog', () => {
  it('survives Esc and closes only via the button, dropping the plaintext', async () => {
    const user = userEvent.setup()
    renderTokens()

    await user.click(await screen.findByRole('button', { name: /new token/i }))
    await user.type(screen.getByLabelText(/name/i), 'mac-test')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Token created')).toBeInTheDocument()
    expect(screen.getByDisplayValue(PLAIN)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.getByText('Token created')).toBeInTheDocument()
    expect(screen.getByDisplayValue(PLAIN)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /stored it/i }))
    await waitFor(() => expect(screen.queryByText('Token created')).toBeNull())
    expect(screen.queryByDisplayValue(PLAIN)).toBeNull()
  })
})
