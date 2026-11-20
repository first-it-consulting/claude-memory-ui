// Admin workspace scope shared across pages: which tenant's data the
// Memories / Sessions / Stats views and the export operate on. Regular users
// always see their own workspace (plus the shared space) — the server scopes
// everything regardless; this only drives the admin's ?tenant= / ?scope=all
// query params.
//
// Landing rule: a saved choice (localStorage) always wins. With no saved
// choice, admins default to "All workspaces" — the pre-multi-tenancy data
// lives in the legacy tenant, so "own" would look empty on first login after
// the rollout. Non-admins always land on their own workspace. The choice is
// persisted as soon as the selector is used and is never auto-overridden.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react'
import { useWhoami } from './useWhoami'

export type Scope = { mode: 'own' } | { mode: 'all' } | { mode: 'tenant'; id: string }

interface ScopeCtx {
  scope: Scope
  setScope: (s: Scope) => void
  /** query params matching the current scope */
  params: Record<string, string>
}

const Ctx = createContext<ScopeCtx>({ scope: { mode: 'own' }, setScope: () => {}, params: {} })

const STORAGE_KEY = 'cm.workspace-scope'

function loadSaved(): Scope | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    if (raw === 'own') return { mode: 'own' }
    if (raw === 'all') return { mode: 'all' }
    const p = JSON.parse(raw)
    if (p && p.mode === 'tenant' && typeof p.id === 'string') return { mode: 'tenant', id: p.id }
  } catch {
    // corrupted or unavailable storage -> behave as "no saved choice"
  }
  return null
}

function save(scope: Scope): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      scope.mode === 'tenant' ? JSON.stringify(scope) : scope.mode,
    )
  } catch {
    // private mode etc. — the choice still applies for this session
  }
}

export function ScopeProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useWhoami()
  const [scope, setScopeState] = useState<Scope>(() => loadSaved() ?? { mode: 'own' })
  // True once the user picked a workspace (or a pick was restored from
  // storage) — the admin default must never override an explicit choice.
  const userChose = useRef(loadSaved() !== null)

  useEffect(() => {
    if (!userChose.current && isAdmin) setScopeState({ mode: 'all' })
  }, [isAdmin])

  const setScope = (s: Scope) => {
    userChose.current = true
    save(s)
    setScopeState(s)
  }

  const params = useMemo((): Record<string, string> => {
    if (scope.mode === 'all') return { scope: 'all' }
    if (scope.mode === 'tenant') return { tenant: scope.id }
    return {}
  }, [scope])
  return <Ctx.Provider value={{ scope, setScope, params }}>{children}</Ctx.Provider>
}

export const useScope = () => useContext(Ctx)
