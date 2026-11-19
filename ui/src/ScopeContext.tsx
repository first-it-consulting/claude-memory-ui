// Admin workspace scope shared across pages: which tenant's data the
// Memories / Sessions / Stats views and the export operate on. Regular users
// always see their own workspace (plus the shared space) — the server scopes
// everything regardless; this only drives the admin's ?tenant= / ?scope=all
// query params.
import { createContext, useContext, useMemo, useState, ReactNode } from 'react'

export type Scope = { mode: 'own' } | { mode: 'all' } | { mode: 'tenant'; id: string }

interface ScopeCtx {
  scope: Scope
  setScope: (s: Scope) => void
  /** query params matching the current scope */
  params: Record<string, string>
}

const Ctx = createContext<ScopeCtx>({ scope: { mode: 'own' }, setScope: () => {}, params: {} })

export function ScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<Scope>({ mode: 'own' })
  const params = useMemo((): Record<string, string> => {
    if (scope.mode === 'all') return { scope: 'all' }
    if (scope.mode === 'tenant') return { tenant: scope.id }
    return {}
  }, [scope])
  return <Ctx.Provider value={{ scope, setScope, params }}>{children}</Ctx.Provider>
}

export const useScope = () => useContext(Ctx)
