// Admin workspace scope selector: own workspace, a single tenant, or all.
// Populates the shared ScopeContext consumed by Memories / Sessions / Stats.
import { useQuery } from '@tanstack/react-query'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { usersApi } from '../api/users'
import { useScope } from '../ScopeContext'

export default function ScopeSelect() {
  const { scope, setScope } = useScope()
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    staleTime: 60_000,
  })

  const value = scope.mode === 'tenant' ? `t:${scope.id}` : scope.mode

  return (
    <FormControl size="small" sx={{ minWidth: 170 }}>
      <InputLabel>Workspace</InputLabel>
      <Select
        label="Workspace"
        value={value}
        onChange={(e) => {
          const v = e.target.value as string
          if (v === 'all') setScope({ mode: 'all' })
          else if (v.startsWith('t:')) setScope({ mode: 'tenant', id: v.slice(2) })
          else setScope({ mode: 'own' })
        }}
      >
        <MenuItem value="own">Mine (+ shared)</MenuItem>
        <MenuItem value="all">All workspaces</MenuItem>
        {users.map(u => (
          <MenuItem key={u.id} value={`t:${u.id}`}>{u.name || u.id}</MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
