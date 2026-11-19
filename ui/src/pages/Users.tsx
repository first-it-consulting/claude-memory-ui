// Admin: tenant management. API tokens are shown exactly once (create /
// rotate) — the server stores only a hash, so a lost token means rotating.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import { usersApi, User } from '../api/users'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function Users() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [issuedToken, setIssuedToken] = useState<{ user: string; token: string } | null>(null)
  const [tokenError, setTokenError] = useState('')

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const createMutation = useMutation({
    mutationFn: () => usersApi.create(newId.trim(), newName.trim(), newRole),
    onSuccess: (res) => {
      setCreateOpen(false)
      setIssuedToken({ user: res.user.id, token: res.token })
      setNewId(''); setNewName(''); setNewRole('user')
      invalidate()
    },
    onError: (e: Error) => setTokenError(e.message),
  })

  const rotateMutation = useMutation({
    mutationFn: (id: string) => usersApi.rotateToken(id),
    onSuccess: (res, id) => setIssuedToken({ user: id, token: res.token }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<User, 'role' | 'disabled'>> }) =>
      usersApi.update(id, patch),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: invalidate,
  })

  const mutationError = createMutation.error || rotateMutation.error || updateMutation.error || deleteMutation.error

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', px: 2, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>Users & Workspaces</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => { setTokenError(''); setCreateOpen(true) }}>
          New user
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Each user has a private workspace (memories + sessions) and one API token for their agents.
        Browser login happens via Keycloak; the first login links the account.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load users.</Alert>}
      {mutationError && <Alert severity="error" sx={{ mb: 2 }}>{(mutationError as Error).message}</Alert>}
      {tokenError && <Alert severity="error" sx={{ mb: 2 }}>{tokenError}</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Workspace</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Keycloak</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Last login</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{u.id}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{u.name || '—'}</TableCell>
                  <TableCell>
                    <TextField
                      select size="small" value={u.role} sx={{ width: 100 }}
                      onChange={e => updateMutation.mutate({ id: u.id, patch: { role: e.target.value as 'user' | 'admin' } })}
                    >
                      <MenuItem value="user">user</MenuItem>
                      <MenuItem value="admin">admin</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    {u.oidc_sub
                      ? <Chip label="linked" size="small" color="success" variant="outlined" sx={{ fontSize: 10, height: 20 }} />
                      : <Chip label="api only" size="small" variant="outlined" sx={{ fontSize: 10, height: 20 }} />}
                  </TableCell>
                  <TableCell>
                    <Switch size="small" checked={!u.disabled}
                      onChange={e => updateMutation.mutate({ id: u.id, patch: { disabled: !e.target.checked } })} />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmtDate(u.last_login_at)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Rotate API token (old token stops working)">
                      <IconButton size="small" onClick={() => rotateMutation.mutate(u.id)} aria-label="Rotate token">
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete account (memories stay in its namespace)">
                      <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(u.id)} aria-label="Delete user">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No users yet — create one to hand out a personal API token.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>New user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField label="Workspace id" size="small" fullWidth value={newId}
              onChange={e => setNewId(e.target.value)}
              helperText="lowercase, used as the workspace name (e.g. alice)"
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }} />
            <TextField label="Display name" size="small" fullWidth value={newName}
              onChange={e => setNewName(e.target.value)} />
            <TextField select label="Role" size="small" value={newRole} onChange={e => setNewRole(e.target.value as 'user' | 'admin')}>
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newId.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* One-time token reveal */}
      <Dialog open={!!issuedToken} onClose={() => setIssuedToken(null)} fullWidth maxWidth="sm">
        <DialogTitle>API token for {issuedToken?.user}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy it now — this is the only time it is shown. Store it in the user's
            <code> ~/.config/agent-memory/env </code> as <code>AGENT_MEMORY_TOKEN</code>.
          </Alert>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small" fullWidth value={issuedToken?.token ?? ''}
              slotProps={{
                input: { readOnly: true },
                htmlInput: { style: { fontFamily: 'monospace', fontSize: 12 } },
              }}
              onFocus={e => (e.target as HTMLInputElement).select()}
            />
            <Tooltip title="Copy">
              <IconButton onClick={() => navigator.clipboard?.writeText(issuedToken?.token ?? '')} aria-label="Copy token">
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setIssuedToken(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
