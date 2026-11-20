import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { type Session, goalOf, sessionsApi } from '../api/sessions'
import ScopeSelect from '../components/ScopeSelect'
import { useScope } from '../ScopeContext'
import { useWhoami } from '../useWhoami'

const HARNESS_COLORS: Record<string, string> = {
  claude: '#d97757',
  codex: '#10a37f',
  pi: '#7c4dff',
  qwen: '#0288d1',
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtAgo(iso: string): string {
  const secs = (Date.now() - new Date(iso).getTime()) / 1000
  if (!Number.isFinite(secs)) return ''
  if (secs < 90) return 'just now'
  if (secs < 3600) return `${Math.round(secs / 60)} min ago`
  if (secs < 86400) return `${Math.round(secs / 3600)} h ago`
  return `${Math.round(secs / 86400)} d ago`
}

function HarnessChip({ harness }: { harness: string }) {
  const color = HARNESS_COLORS[harness]
  return (
    <Chip
      label={harness || 'unknown'}
      size="small"
      variant="outlined"
      sx={{ fontSize: 11, fontFamily: 'monospace', borderColor: color || 'divider', color: color || 'text.secondary' }}
    />
  )
}

function Section({ title, text, hint }: { title: string; text: string; hint?: string }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0, p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider',
          bgcolor: 'action.hover', fontSize: 12, lineHeight: 1.5, fontFamily: 'monospace',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}
      >
        {text}
      </Box>
    </Box>
  )
}

function SessionDrawer({ session, onClose, onDelete }: {
  session: Session | null
  onClose: () => void
  onDelete: (s: Session) => void
}) {
  return (
    <Drawer anchor="right" open={!!session} onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 640 } } } }}>
      {session && (
        <Box sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              {session.project || 'no project'}
            </Typography>
            <HarnessChip harness={session.harness} />
            <IconButton size="small" onClick={onClose} aria-label="Close"><CloseIcon fontSize="small" /></IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }} color="text.secondary">
              {session.session_id}
            </Typography>
            <Tooltip title="Copy session id">
              <IconButton size="small" sx={{ border: 'none' }}
                onClick={() => navigator.clipboard?.writeText(session.session_id)} aria-label="Copy session id">
                <ContentCopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 2 }}>
            started {fmtDate(session.created_at)} · updated {fmtDate(session.updated_at)} ({fmtAgo(session.updated_at)})
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {session.state
            ? <Section title="Checkpoint" hint="saved by the agent, re-injected after compaction" text={session.state} />
            : <Alert severity="info" sx={{ mb: 3 }}>No checkpoint saved by the agent yet.</Alert>}
          {session.auto_notes && (
            <Section title="Auto-captured before compaction" hint="raw, from the transcript" text={session.auto_notes} />
          )}

          <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete(session)}>
            Delete session
          </Button>
        </Box>
      )}
    </Drawer>
  )
}

export default function Sessions() {
  const queryClient = useQueryClient()
  const { scope, params: scopeParams } = useScope()
  const { isAdmin } = useWhoami()
  const [project, setProject] = useState('')
  const [harness, setHarness] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Session | null>(null)
  const [toDelete, setToDelete] = useState<Session | null>(null)

  // Load everything once (max 100 most recent, in the admin's selected
  // workspace scope) and filter client-side, so the project/harness pickers
  // always offer all known values.
  const { data: sessions = [], isLoading, isError } = useQuery({
    queryKey: ['sessions', scopeParams],
    queryFn: () => sessionsApi.list({ limit: 100, ...scopeParams }),
    refetchInterval: 30_000,
  })

  const remove = useMutation({
    mutationFn: (id: string) => sessionsApi.remove(id, scopeParams),
    onSuccess: (_r, id) => {
      queryClient.setQueryData<Session[]>(['sessions'], old => (old ?? []).filter(s => s.session_id !== id))
      if (selected?.session_id === id) setSelected(null)
      setToDelete(null)
    },
  })

  const projects = useMemo(() => [...new Set(sessions.map(s => s.project).filter(Boolean))].sort(), [sessions])
  const harnesses = useMemo(() => [...new Set(sessions.map(s => s.harness).filter(Boolean))].sort(), [sessions])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sessions.filter(s =>
      (!project || s.project === project) &&
      (!harness || s.harness === harness) &&
      (!q || `${s.session_id} ${s.project} ${s.state} ${s.auto_notes}`.toLowerCase().includes(q)),
    )
  }, [sessions, project, harness, search])

  const withCheckpoint = sessions.filter(s => s.state).length

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: 2, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Sessions</Typography>
        <Typography variant="caption" color="text.secondary">
          working memory of agent sessions (checkpoints survive context compaction)
        </Typography>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{sessions.length}</Typography>
          <Typography variant="caption" color="text.secondary">sessions</Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{withCheckpoint}</Typography>
          <Typography variant="caption" color="text.secondary">with checkpoint</Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{projects.length}</Typography>
          <Typography variant="caption" color="text.secondary">projects</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" placeholder="Search checkpoints…" value={search}
          onChange={e => setSearch(e.target.value)} sx={{ minWidth: 240, flex: 1 }} />
        <TextField size="small" select label="Project" value={project}
          onChange={e => setProject(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All projects</MenuItem>
          {projects.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
        </TextField>
        <ToggleButtonGroup size="small" exclusive value={harness} onChange={(_, v) => setHarness(v ?? '')}>
          <ToggleButton value="" sx={{ textTransform: 'none', px: 1.5 }}>All</ToggleButton>
          {harnesses.map(h => (
            <ToggleButton key={h} value={h} sx={{ textTransform: 'none', px: 1.5, fontFamily: 'monospace' }}>{h}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        {isAdmin && <ScopeSelect />}
      </Box>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load sessions.</Alert>}
      {remove.isError && <Alert severity="error" sx={{ mb: 2 }}>Delete failed: {(remove.error as Error).message}</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Updated</TableCell>
                {scope.mode !== 'own' && <TableCell>Workspace</TableCell>}
                <TableCell>Project</TableCell>
                <TableCell>Harness</TableCell>
                <TableCell>Goal</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map(s => (
                <TableRow key={s.session_id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(s)}>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                    <Tooltip title={fmtDate(s.updated_at)}><span>{fmtAgo(s.updated_at)}</span></Tooltip>
                  </TableCell>
                  {scope.mode !== 'own' && (
                    <TableCell sx={{ fontSize: 11, fontFamily: 'monospace' }}>{s.owner || 'default'}</TableCell>
                  )}
                  <TableCell sx={{ fontSize: 12, fontWeight: 500 }}>{s.project || '—'}</TableCell>
                  <TableCell><HarnessChip harness={s.harness} /></TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 520 }}>
                    <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {goalOf(s) || <Typography component="span" variant="caption" color="text.secondary">—</Typography>}
                    </Box>
                    {!s.state && (
                      <Typography variant="caption" color="text.secondary">auto-captured only</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <Tooltip title="Delete session">
                      <IconButton size="small" onClick={() => setToDelete(s)} aria-label="Delete session">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={scope.mode !== 'own' ? 6 : 5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    {sessions.length === 0
                      ? 'No sessions yet. Agents with the claude-memory adapter save checkpoints here.'
                      : 'No sessions match the filters.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <SessionDrawer session={selected} onClose={() => setSelected(null)} onDelete={setToDelete} />

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogTitle>Delete session?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The checkpoint of <b>{toDelete?.project || 'this session'}</b> ({toDelete?.harness}) is removed
            permanently. If the agent is still running, it can no longer restore this state after compaction.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={remove.isPending}
            onClick={() => toDelete && remove.mutate(toDelete.session_id)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
