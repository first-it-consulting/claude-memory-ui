// Browser authentication. With OIDC enabled (ui-config.json) the SPA does
// Keycloak's authorization-code + PKCE flow via keycloak-js and every API
// call carries the access token; the UI proxy forwards it untouched. Without
// OIDC the SPA sends no auth header and the proxy injects the legacy shared
// token (single-tenant mode).
import Keycloak from 'keycloak-js'

export interface UiConfig {
  oidc_enabled: boolean
  keycloak_url: string
  realm: string
  client_id: string
}

let config: UiConfig | null = null
let kc: Keycloak | null = null

export async function loadConfig(): Promise<UiConfig> {
  if (!config) {
    try {
      const res = await fetch('/ui-config.json')
      config = await res.json()
    } catch {
      // Proxy not reachable (e.g. Vite dev server without the FastAPI layer):
      // behave like legacy single-tenant mode instead of blocking the UI.
      config = { oidc_enabled: false, keycloak_url: '', realm: '', client_id: '' }
    }
  }
  return config as UiConfig
}

/** Initialise Keycloak; resolves true when the user is authenticated
 *  (always true in legacy mode). Redirects to Keycloak when not signed in. */
/** Whether OIDC is configured (after loadConfig/initAuth). */
export function oidcEnabled(): boolean {
  return config?.oidc_enabled === true
}

export async function initAuth(): Promise<boolean> {
  const cfg = await loadConfig()
  if (!cfg.oidc_enabled) return true
  kc = new Keycloak({ url: cfg.keycloak_url, realm: cfg.realm, clientId: cfg.client_id })
  // Ask Keycloak for a fresh token when it expires mid-session.
  kc.onTokenExpired = () => {
    kc?.updateToken(60).catch(() => login())
  }
  const authenticated = await kc.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  })
  return authenticated
}

export function login(): void {
  if (kc) kc.login({ redirectUri: window.location.origin + window.location.pathname })
}

export function logout(): void {
  if (kc) kc.logout({ redirectUri: window.location.origin + window.location.pathname })
  else window.location.reload()
}

/** Authorization header for API calls (empty in legacy mode). Refreshes the
 *  token proactively if it expires within 30s. */
export async function authHeader(): Promise<Record<string, string>> {
  if (!kc?.authenticated || !kc.token) return {}
  try {
    await kc.updateToken(30)
  } catch {
    login()
    throw new Error('401 session expired')
  }
  return { Authorization: `Bearer ${kc.token}` }
}
