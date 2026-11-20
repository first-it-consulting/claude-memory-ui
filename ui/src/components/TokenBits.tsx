// Shared display bits for the token pages (self-service + admin).
import Chip from '@mui/material/Chip'
import { statusOf, type TokenRow } from '../api/tokens'

export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function TokenStatusChip({ t }: { t: TokenRow }) {
  const s = statusOf(t)
  const label =
    s === 'revoked' ? 'revoked'
    : s === 'expired' ? 'expired'
    : s === 'expiring' ? `expires in ${t.expires_in_days}d`
    : t.expires_in_days === null ? 'active · never expires'
    : `active · ${t.expires_in_days}d left`
  const color =
    s === 'revoked' || s === 'expired' ? 'default'
    : s === 'expiring' ? 'warning'
    : 'success'
  return <Chip label={label} size="small" color={color} variant="outlined"
               sx={{ fontSize: 10, height: 20 }} />
}

export function TokenNameCell({ t }: { t: TokenRow }) {
  return (
    <span>
      {t.name}
      {t.can_admin && (
        <Chip label="admin" size="small" color="warning" variant="outlined"
              sx={{ ml: 0.5, fontSize: 10, height: 18 }} />
      )}
      {t.default_harness && (
        <Chip label={t.default_harness} size="small" variant="outlined"
              sx={{ ml: 0.5, fontSize: 10, height: 18 }} />
      )}
    </span>
  )
}
