// Self-service API tokens for every signed-in user. The plaintext is shown
// exactly once and is dropped from component state when the reveal dialog
// closes — it never reaches localStorage or the URL.
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
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
import { tokensApi, type TokenRow, type CreateTokenResult } from '../api/tokens'
import { TokenNameCell, TokenStatusChip, fmtDate } from '../components/TokenBits'
import { useWhoami } from '../useWhoami'

const HARNESS_OPTIONS = ['', 'claude', 'codex', 'qwen', 'pi']

export default function Tokens() {
  const qc = useQueryClient()
  const { isAdmin } = useWhoami()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [expiresDays, setExpiresDays] = useState(90)
  const [harness, setHarness] = useState('')
  const [canAdmin, setCanAdmin] = useState(false)
  const [issued, setIssued] = useState<CreateTokenResult | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<TokenRow | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-tokens'],
    queryFn: tokensApi.mine,
  })
  const tokens = data?.tokens ?? []

  const createMutation = useMutation({
    mutationFn: () => tokensApi.create({
      name: name.trim(),
      expires_days: expiresDays,
      default_harness: harness,
      can_admin: canAdmin,
    }),
    onSuccess: (res) => {
      setCreateOpen(false)
      setName(''); setExpiresDays(90); setHarness(''); setCanAdmin(false)
      setIssued(res)
      qc.invalidateQueries({ queryKey: ['my-tokens'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => tokensApi.revoke(id),
    onSuccess: () => {
      setRevokeTarget(null)
      qc.invalidateQueries({ queryKey: ['my-tokens'] })
    },
  })

  const closeReveal = () => {
    setIssued(null)
    createMutation.reset()   // drop the plaintext from the mutation cache too
  }

  const mutationError = createMutation.error || revokeMutation.error

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', px: 2, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>My API tokens</Typography>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setCreateOpen(true)}>
          New token
        </Button>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Tokens authenticate your agents (MCP + hooks) as you. Put one in
        <code> ~/.config/agent-memory/env </code> as <code>AGENT_MEMORY_TOKEN</code>.
        The value is shown once — a lost token is replaced, not recovered.
      </Typography>

      <Divider sx={{ mb: 2 }} />

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load tokens.</Alert>}
      {mutationError && <Alert severity="error" sx={{ mb: 2 }}>{(mutationError as Error).message}</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Token</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Last used</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {tokens.map(t => (
                <TableRow key={t.id}>
                  <TableCell sx={{ fontSize: 12 }}><TokenNameCell t={t} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{t.display}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmtDate(t.created_at)}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{fmtDate(t.last_used_at)}</TableCell>
                  <TableCell><TokenStatusChip t={t} /></TableCell>
                  <TableCell align="right">
                    {!t.revoked_at && (
                      <Tooltip title="Revoke this token">
                        <IconButton size="small" color="error" onClick={() => setRevokeTarget(t)}
                          aria-label={`Revoke ${t.name}`}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tokens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No tokens yet — create one for each device or agent you run.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New token</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField label="Name" size="small" fullWidth required value={name}
              onChange={e => setName(e.target.value)}
              helperText="What uses it (e.g. mac-office, nas-backup)" />
            <TextField select label="Expires in" size="small" value={expiresDays}
              onChange={e => setExpiresDays(Number(e.target.value))}>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={90}>90 days (default)</MenuItem>
              <MenuItem value={365}>365 days (max)</MenuItem>
            </TextField>
            <TextField select label="Default harness" size="small" value={harness}
              onChange={e => setHarness(e.target.value)}>
              {HARNESS_OPTIONS.map(h => (
                <MenuItem key={h} value={h}>{h || 'none'}</MenuItem>
              ))}
            </TextField>
            {isAdmin && (
              <FormControlLabel
                control={<Checkbox size="small" checked={canAdmin}
                  onChange={e => setCanAdmin(e.target.checked)} />}
                label={<Typography variant="body2">Admin rights (this token can act as admin)</Typography>}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* One-time reveal — the value lives in state only until closed.
          Esc and backdrop clicks must not destroy it: only the button does. */}
      <Dialog open={!!issued}
              onClose={() => { /* MUI v9 dropped disableEscapeKeyDown: swallow
                escapeKeyDown and backdropClick here — only the button below
                closes, so a stray key or click never destroys the plaintext */ }}
              fullWidth maxWidth="sm">
        <DialogTitle>Token created</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Copy it now — this is the only time it is shown. Store it in
            <code> ~/.config/agent-memory/env </code> as <code>AGENT_MEMORY_TOKEN</code>.
            {issued?.note ? ` (${issued.note})` : ''}
          </Alert>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small" fullWidth value={issued?.token ?? ''}
              slotProps={{
                input: { readOnly: true },
                htmlInput: { style: { fontFamily: 'monospace', fontSize: 12 } },
              }}
              onFocus={e => (e.target as HTMLInputElement).select()}
            />
            <Tooltip title="Copy">
              <IconButton onClick={() => navigator.clipboard?.writeText(issued?.token ?? '')}
                aria-label="Copy token">
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={closeReveal}>I stored it — close</Button>
        </DialogActions>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={!!revokeTarget} onClose={() => setRevokeTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Revoke “{revokeTarget?.name}”?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Any agent using <code>{revokeTarget?.display}</code> stops working
            immediately. This cannot be undone — create a new token instead.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" disabled={revokeMutation.isPending}
            onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}>
            Revoke
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
