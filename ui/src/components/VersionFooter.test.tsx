// Footer: baked UI identity plus the server version from GET /api/version.
// Vite define does not run under vitest, so the UI part renders as 'dev'.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import VersionFooter from './VersionFooter'

const json = (obj: unknown) =>
  new Response(JSON.stringify(obj), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/api/version')
        ? json({ version: '9.9.9', commit: 'abc1234567890123' })
        : json({}),
    ),
  )
})

const renderFooter = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VersionFooter />
    </QueryClientProvider>,
  )

describe('VersionFooter', () => {
  it('shows the UI identity and server version+short sha', async () => {
    renderFooter()
    expect(await screen.findByText('UI dev · Server 9.9.9+abc1234')).toBeInTheDocument()
  })

  it('hides the server segment when /api/version fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network down')
      }),
    )
    renderFooter()
    expect(await screen.findByText('UI dev')).toBeInTheDocument()
  })
})
