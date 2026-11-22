// Admin: share-proposal worklist (server bean oi38). Pending proposals with
// Approve / Reject-with-reason; the approve call can come back 409
// "changed since proposal" when the owner edited the content after
// proposing — surfaced verbatim, the row is never silently approved.
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
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { proposalsApi, type Proposal } from '../api/proposals'

function fmtWhen(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function Proposals() {
  const qc = useQueryClient()
  const [status, setStatus] = useState<'proposed' | 'rejected' | 'all'>('proposed')
  const [toReject, setToReject] = useState<Proposal | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  // ids whose last approve was refused because the owner edited after
  // proposing — the card keeps showing why until the owner re-proposes
  const [changed, setChanged] = useState<Record<string, boolean>>({})

  const { data: proposals = [], isLoading, isError } = useQuery({
    queryKey: ['proposals', status],
    queryFn: () => proposalsApi.list(status),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['proposals'] })
    qc.invalidateQueries({ queryKey: ['memories'] })
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) => proposalsApi.approve(id),
    onSuccess: (_r, id) => {
      setChanged(prev => ({ ...prev, [id]: false }))
      invalidate()
    },
    // 409 body: {"ok":false,"error":"content changed since proposal - ..."};
    // request() throws "409 Conflict" without the body, so re-read it is not
    // possible here — map the status text to the lead-mandated wording.
    onError: (e: Error, id) => {
      if (e.message.startsWith('409')) {
        setChanged(prev => ({ ...prev, [id]: true }))
        setError('Changed since proposal — the owner edited it after proposing. Ask them to re-propose.')
      } else {
        setError(`Approve failed: ${e.message}`)
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      proposalsApi.reject(id, reason),
    onSuccess: () => {
      setToReject(null)
      setReason('')
      invalidate()
    },
    onError: (e: Error) => setError(`Reject failed: ${e.message}`),
  })

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: 2, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          Share proposals
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_e, v) => v && setStatus(v as typeof status)}
          aria-label="Proposal status filter"
        >
          <ToggleButton value="proposed">Pending</ToggleButton>
          <ToggleButton value="rejected">Rejected</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Divider sx={{ mb: 2 }} />

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load proposals.</Alert>}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {proposals.map(p => (
            <Box
              key={p.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  component="pre"
                  sx={{
                    fontFamily: 'monospace', fontSize: 12.5, whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word', m: 0, color: 'text.primary',
                  }}
                >
                  {p.memory}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip label={p.tenant} size="small" variant="outlined" sx={{ fontSize: 11, fontFamily: 'monospace' }} />
                  <Chip
                    label={`proposed ${fmtWhen(p.proposed_at)}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 11 }}
                  />
                  {p.share_status === 'rejected' && (
                    <Tooltip title={p.rejected_reason || 'no reason given'}>
                      <Chip
                        label={`rejected ${fmtWhen(p.rejected_at)}${p.rejected_by ? ` by ${p.rejected_by}` : ''}`}
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontSize: 11 }}
                      />
                    </Tooltip>
                  )}
                  {changed[p.id] && (
                    <Chip label="changed since proposal" size="small" color="warning" variant="outlined" sx={{ fontSize: 11 }} />
                  )}
                </Box>
              </Box>
              {p.share_status === 'proposed' && (
                <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(p.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => { setToReject(p); setReason('') }}
                  >
                    Reject
                  </Button>
                </Box>
              )}
            </Box>
          ))}
          {proposals.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
              No {status === 'all' ? '' : `${status} `}proposals.
            </Typography>
          )}
        </Stack>
      )}

      {/* Reject with reason (owner sees it as a chip tooltip, bean oi38) */}
      <Dialog open={!!toReject} onClose={() => setToReject(null)}>
        <DialogTitle>Reject proposal?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            The memory stays in <b>{toReject?.tenant}</b>'s workspace untouched.
            The owner sees a <b>rejected</b> marker with your reason and can
            re-propose.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Reason (shown to the owner)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToReject(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={rejectMutation.isPending}
            onClick={() => toReject && rejectMutation.mutate({ id: toReject.id, reason: reason.trim() })}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={8000}
        onClose={() => setError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}
