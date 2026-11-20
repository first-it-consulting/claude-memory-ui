// Admin: every user's API tokens, masked. Revoke anything; minting is always
// self-service, so an admin never sees another user's plaintext.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { tokensApi, type TokenRow } from '../api/tokens'
import { TokenNameCell, TokenStatusChip, fmtDate } from '../components/TokenBits'
import { usersApi } from '../api/users'

export default function AdminTokens() {
  const qc = useQueryClient()
  const [userFilter, setUserFilter] = useState('')
  const [revokeTarget, setRevokeTarget] = useState<TokenRow | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-tokens', userFilter],
    queryFn: () => tokensApi.adminList(userFilter || undefined),
  })
  const tokens = data?.tokens ?? []

  const revokeMutation = useMutation({
    mutationFn: (id: string) => tokensApi.adminRevoke(id),
    onSuccess: () => {
      setRevokeTarget(null)
      qc.invalidateQueries({ queryKey: ['admin-tokens'] })
    },
  })

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: 2, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>All API tokens</Typography>
        <TextField select size="small" label="User" value={userFilter} sx={{ width: 180 }}
          onChange={e => setUserFilter(e.target.value)}>
          <MenuItem value="">all users</MenuItem>
          {users.map(u => <MenuItem key={u.id} value={u.id}>{u.id}</MenuItem>)}
        </TextField>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Values are never shown — only the prefix and last four. Revoke here when a
        device is lost; users mint their own replacements under “My tokens”.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load tokens.</Alert>}
      {revokeMutation.error && <Alert severity="error" sx={{ mb: 2 }}>{(revokeMutation.error as Error).message}</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Token</TableCell>
                <TableCell>Created by</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {tokens.map(t => (
                <TableRow key={t.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{t.user_id}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}><TokenNameCell t={t} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{t.display}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{t.created_by}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmtDate(t.last_used_at)}</TableCell>
                  <TableCell><TokenStatusChip t={t} /></TableCell>
                  <TableCell align="right">
                    {!t.revoked_at && (
                      <Tooltip title="Revoke this token">
                        <IconButton size="small" color="error" onClick={() => setRevokeTarget(t)}
                          aria-label={`Revoke ${t.user_id}/${t.name}`}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tokens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No tokens for this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Revoke confirm — legacy-hooks is the shared fleet token: killing it
          takes every remaining hook down at once, so require typed consent. */}
      <Dialog open={!!revokeTarget} maxWidth="xs" fullWidth
              onClose={() => { setRevokeTarget(null); setConfirmText('') }}>
        <DialogTitle>Revoke {revokeTarget?.user_id}’s “{revokeTarget?.name}”?</DialogTitle>
        <DialogContent>
          {revokeTarget?.name === 'legacy-hooks' ? (
            <>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                <b>Blast radius: every remaining client.</b> This is the shared
                legacy token used by all not-yet-migrated hooks and MCP devices
                — revoking it stops them all immediately, and old configs keep
                failing until each device gets its own token. Migrate devices
                first (see docs/token-migration.md in the server repo).
              </Typography>
              <TextField size="small" fullWidth label="Type revoke-all-hooks to confirm"
                value={confirmText} onChange={e => setConfirmText(e.target.value)}
                slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }} />
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Any agent using <code>{revokeTarget?.display}</code> stops working
              immediately. This cannot be undone.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setRevokeTarget(null); setConfirmText('') }}>Cancel</Button>
          <Button variant="contained" color="error"
            disabled={revokeMutation.isPending
              || (revokeTarget?.name === 'legacy-hooks' && confirmText !== 'revoke-all-hooks')}
            onClick={() => {
              if (revokeTarget) revokeMutation.mutate(revokeTarget.id)
              setConfirmText('')
            }}>
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
