import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { JobRun, jobsApi } from '../api/jobs'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(secs: number | null): string {
  if (secs == null) return '—'
  if (secs < 60) return `${secs.toFixed(1)}s`
  return `${(secs / 60).toFixed(1)}m`
}

function StatusChip({ status }: { status: JobRun['status'] }) {
  const color = status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning'
  return <Chip label={status} size="small" color={color as any} variant="outlined" sx={{ fontSize: 11 }} />
}

function PhaseChip({ phase }: { phase: string }) {
  const colors: Record<string, string> = {
    'llm-tagging': '#7c4dff',
    'hash-dedup': '#0288d1',
    'semantic-dedup': '#00897b',
    'checkpoint-promotion': '#ef6c00',
  }
  return (
    <Chip
      label={phase}
      size="small"
      variant="outlined"
      sx={{ fontSize: 11, fontFamily: 'monospace', borderColor: colors[phase] || 'divider', color: colors[phase] || 'text.primary' }}
    />
  )
}

export default function Jobs() {
  const { data: jobs = [], isLoading, isError } = useQuery({
    queryKey: ['jobs'],
    queryFn: jobsApi.list,
    refetchInterval: 30_000,
  })

  // Aggregate totals across all completed runs
  const completed = jobs.filter(j => j.status === 'completed')
  const totalTagged = completed.filter(j => j.phase === 'llm-tagging').reduce((s, j) => s + j.memories_changed, 0)
  const totalDeduped = completed.filter(j => j.phase === 'hash-dedup' || j.phase === 'semantic-dedup').reduce((s, j) => s + j.memories_changed, 0)
  // dry runs only report what would be promoted
  const totalPromoted = completed
    .filter(j => j.phase === 'checkpoint-promotion' && !(j.details ?? '').startsWith('DRY RUN'))
    .reduce((s, j) => s + j.memories_changed, 0)
  const totalRulesAdded = completed.reduce((s, j) => s + (j.rules_added ?? 0), 0)
  const lastRun = jobs[0] ?? null
  // mode of checkpoint promotion, as seen in its latest report (jobs are newest first)
  const lastPromotion = jobs.find(j => j.phase === 'checkpoint-promotion' && j.status === 'completed')
  const promotionMode = !lastPromotion ? null : (lastPromotion.details ?? '').startsWith('DRY RUN') ? 'dry-run' : 'on'
  const [report, setReport] = useState<JobRun | null>(null)

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: 2, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Nightly Job History</Typography>
        <Typography variant="caption" color="text.secondary">
          {lastRun ? `last run ${fmtDate(lastRun.started_at)}` : 'no runs yet'}
        </Typography>
      </Box>

      {promotionMode && (
        <Tooltip title={`From the latest checkpoint-promotion run (${fmtDate(lastPromotion!.started_at)}). Set via PROMOTE_MODE in the dedup CronJob.`}>
          <Chip
            size="small"
            label={`Checkpoint promotion: ${promotionMode === 'on' ? 'ON' : 'DRY RUN (report only)'}`}
            sx={{ mb: 1, fontWeight: 600, bgcolor: promotionMode === 'on' ? '#2e7d32' : '#ef6c00', color: '#fff' }}
          />
        </Tooltip>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Summary stats */}
      <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{jobs.length}</Typography>
          <Typography variant="caption" color="text.secondary">total phases logged</Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalTagged.toLocaleString()}</Typography>
          <Typography variant="caption" color="text.secondary">memories LLM-tagged</Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalDeduped.toLocaleString()}</Typography>
          <Typography variant="caption" color="text.secondary">memories deduped</Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalPromoted.toLocaleString()}</Typography>
          <Typography variant="caption" color="text.secondary">checkpoint lines promoted</Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{totalRulesAdded.toLocaleString()}</Typography>
          <Typography variant="caption" color="text.secondary">rules discovered</Typography>
        </Box>
      </Box>

      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load job history.</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Started</TableCell>
                <TableCell>Phase</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Scanned</TableCell>
                <TableCell align="right">Changed</TableCell>
                <TableCell align="right">Rules+</TableCell>
                <TableCell align="right">Duration</TableCell>
                <TableCell>Error</TableCell>
                <TableCell>Report</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map(job => (
                <TableRow key={job.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(job.started_at)}</TableCell>
                  <TableCell><PhaseChip phase={job.phase} /></TableCell>
                  <TableCell><StatusChip status={job.status} /></TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{job.memories_scanned ?? 0}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{job.memories_changed ?? 0}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{job.rules_added ?? 0}</TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{fmtDuration(job.duration_seconds)}</TableCell>
                  <TableCell sx={{ fontSize: 11, color: 'error.main', maxWidth: 200 }}>
                    {job.error ? (
                      <Tooltip title={job.error}>
                        <span style={{ cursor: 'help' }}>{job.error.slice(0, 60)}{job.error.length > 60 ? '…' : ''}</span>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {job.details ? (
                      <Button size="small" onClick={() => setReport(job)} sx={{ fontSize: 11, minWidth: 0 }}>
                        view
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No job runs yet. The nightly CronJob logs each phase here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!report} onClose={() => setReport(null)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontSize: 16 }}>
          {report?.phase} · {fmtDate(report?.started_at ?? null)}
        </DialogTitle>
        <DialogContent dividers>
          <Box component="pre" sx={{ m: 0, fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {report?.details}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
