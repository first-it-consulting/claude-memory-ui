import { useCallback, useDeferredValue, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import FormControl from '@mui/material/FormControl'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import SearchIcon from '@mui/icons-material/Search'
import { api, type FetchParams } from '../api/memories'
import { download } from '../api/http'
import MemoryCard from '../components/MemoryCard'
import StatsBar from '../components/StatsBar'
import ScopeSelect from '../components/ScopeSelect'
import { useScope } from '../ScopeContext'
import { useWhoami } from '../useWhoami'

type Sort = 'newest' | 'oldest' | 'relevance'

export default function Memories() {
  const qc = useQueryClient()
  const { scope, params: scopeParams } = useScope()
  const { me, isAdmin } = useWhoami()

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<Sort>('newest')
  const [agentFilter, setAgentFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [autoOnly, setAutoOnly] = useState(false)
  const [addText, setAddText] = useState('')
  const [addShared, setAddShared] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  // admin share flow (bean vd3y): card button -> confirm dialog -> PATCH
  const [toShare, setToShare] = useState<(typeof memories)[number] | null>(null)
  const [shareError, setShareError] = useState('')

  const deferredSearch = useDeferredValue(search)

  const fetchParams: FetchParams = {
    q: deferredSearch || undefined,
    sort: deferredSearch ? 'relevance' : sort,
    agent_id: agentFilter || undefined,
    category: categoryFilter || undefined,
    tag: autoOnly ? 'auto-promoted' : undefined,
    ...scopeParams,
  }

  const { data: stats } = useQuery({
    queryKey: ['stats', scopeParams],
    queryFn: () => api.stats(scopeParams),
    refetchInterval: 30_000,
  })

  const { data: memories = [], isLoading, isError } = useQuery({
    queryKey: ['memories', fetchParams],
    queryFn: () => api.list(fetchParams),
  })

  const agents = stats ? Object.keys(stats.by_agent).sort() : []
  const categories = stats ? Object.keys(stats.by_category).filter(c => c !== 'uncategorized').sort() : []

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['memories'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }, [qc])

  const addMutation = useMutation({
    mutationFn: ({ content, shared }: { content: string; shared: boolean }) => api.add(content, shared),
    onSuccess: () => { setAddText(''); setAddShared(false); setShowAdd(false); invalidate() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => api.update(id, content),
    onSuccess: invalidate,
  })

  const updateTagsMutation = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => api.updateTags(id, tags),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(id),
    onSuccess: invalidate,
  })

  const shareMutation = useMutation({
    mutationFn: (id: string) => api.share(id),
    onSuccess: () => { setToShare(null); invalidate() },
    // 403/404/503 come back as "403 Forbidden" style messages from request()
    onError: (e: Error) => { setToShare(null); setShareError(`Share failed: ${e.message}`) },
  })

  const sharedTenant = me?.shared_tenant ?? 'global'
  // Own workspace or (for admins) anything; non-admins never edit the shared
  // space or foreign workspaces — the server would answer 404 anyway.
  const canEdit = (m: (typeof memories)[number]) =>
    isAdmin || (!!me && m.tenant === me.user_id)
  // admins only, and not for rows already in the shared space (the move
  // would be a no-op there; the server answers already_shared)
  const canShare = (m: (typeof memories)[number]) =>
    isAdmin && m.tenant !== sharedTenant

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', px: 2, py: 3 }}>
      {/* Stats */}
      {stats && <StatsBar stats={stats} />}

      <Divider sx={{ mb: 2 }} />

      {/* Toolbar */}
      <Toolbar disableGutters sx={{ gap: 1, flexWrap: 'wrap', mb: 2, minHeight: 'unset !important' }}>
        <TextField
          placeholder="Search memories…"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 200px' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        {isAdmin && <ScopeSelect />}

        {!search && (
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Sort</InputLabel>
            <Select value={sort} label="Sort" onChange={(e) => setSort(e.target.value as Sort)}>
              <MenuItem value="newest">Newest first</MenuItem>
              <MenuItem value="oldest">Oldest first</MenuItem>
            </Select>
          </FormControl>
        )}

        {agents.length > 1 && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Agent</InputLabel>
            <Select value={agentFilter} label="Agent" onChange={(e) => setAgentFilter(e.target.value)}>
              <MenuItem value="">All agents</MenuItem>
              {agents.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        {categories.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} label="Category" onChange={(e) => setCategoryFilter(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <Tooltip title="Filter: show only memories copied automatically from the Decisions / Dead ends of finished session checkpoints">
          <FormControlLabel
            control={<Switch size="small" checked={autoOnly} onChange={(e) => setAutoOnly(e.target.checked)} />}
            label={<Typography variant="body2">Only auto-promoted</Typography>}
            sx={{ mx: 0.5 }}
          />
        </Tooltip>

        <Button
          startIcon={<AddIcon />}
          variant="outlined"
          size="small"
          onClick={() => setShowAdd((v) => !v)}
        >
          Add
        </Button>

        <Button
          startIcon={<DownloadIcon />}
          variant="outlined"
          size="small"
          onClick={() => download(api.exportPath(scopeParams), 'memories.json')}
        >
          Export
        </Button>
      </Toolbar>

      {/* Add form */}
      {showAdd && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              multiline
              minRows={2}
              fullWidth
              size="small"
              placeholder="Type a memory to add…"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace', fontSize: 13 } } }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={!addText.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate({ content: addText.trim(), shared: addShared })}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Save
            </Button>
          </Box>
          {isAdmin && (
            <Tooltip title="Publish into the shared space so every workspace can read it (instead of your own workspace)">
              <FormControlLabel
                control={<Switch size="small" checked={addShared} onChange={(e) => setAddShared(e.target.checked)} />}
                label={<Typography variant="body2">Publish to shared space</Typography>}
                sx={{ mt: 0.5 }}
              />
            </Tooltip>
          )}
        </Box>
      )}

      {/* Results header */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {isLoading ? 'Loading…' : `${memories.length.toLocaleString()} ${search ? 'results' : 'memories'}`}
      </Typography>

      {/* Content */}
      {isError && <Alert severity="error" sx={{ mb: 2 }}>Failed to load memories.</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={1}>
          {memories.map((m) => (
            <MemoryCard
              key={m.id}
              memory={m}
              canEdit={canEdit(m)}
              canShare={canShare(m)}
              showTenant={scope.mode !== 'own' || m.tenant === sharedTenant}
              sharedTenant={sharedTenant}
              onDelete={(id) => deleteMutation.mutate(id)}
              onUpdate={(id, content) => updateMutation.mutate({ id, content })}
              onUpdateTags={(id, tags) => updateTagsMutation.mutate({ id, tags })}
              onShare={() => setToShare(m)}
            />
          ))}
          {memories.length === 0 && (
            <Typography color="text.secondary" align="center" sx={{ py: 6 }}>
              {search ? `No results for "${search}"` : 'No memories yet.'}
            </Typography>
          )}
        </Stack>
      )}

      {/* Share-to-all confirm (admin, bean vd3y) */}
      <Dialog open={!!toShare} onClose={() => setToShare(null)}>
        <DialogTitle>Share to all?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This moves the memory into the shared space (<b>{sharedTenant}</b>) — every
            workspace will read it, and it leaves <b>{toShare?.tenant}</b>'s own list
            (the original owner keeps seeing it via the shared space). The id is kept
            and the move is recorded with you as <code>shared_by</code>.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToShare(null)}>Cancel</Button>
          <Button
            color="primary"
            variant="contained"
            disabled={shareMutation.isPending || !toShare}
            onClick={() => toShare && shareMutation.mutate(toShare.id)}
          >
            Share to all
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!shareError}
        autoHideDuration={6000}
        onClose={() => setShareError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" variant="filled" onClose={() => setShareError('')}>
          {shareError}
        </Alert>
      </Snackbar>
    </Box>
  )
}
