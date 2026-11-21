// App-shell footer: 'UI <version> (<sha>) · Server <version>+<sha>'.
// UI identity is baked at build time; the server part comes from the
// authenticated GET /api/version. Missing server data hides that segment.
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/auth'

const short = (s?: string) => (s && s !== 'unknown' ? s.slice(0, 7) : '')

export default function VersionFooter() {
  const ui = import.meta.env.VITE_APP_VERSION || 'dev'
  const uiSha = import.meta.env.VITE_GIT_SHA || 'unknown'
  const { data } = useQuery({
    queryKey: ['version'],
    queryFn: authApi.version,
    staleTime: 3_600_000,
    retry: false,
  })
  const serverShort = short(data?.commit)
  const server = data?.version
    ? `Server ${data.version}${serverShort ? `+${serverShort}` : ''}`
    : ''
  const tooltip = `UI ${ui} (${uiSha})${data?.version ? ` · Server ${data.version} (${data.commit})` : ''}`
  return (
    <Box component="footer" sx={{ px: 2, py: 0.5, textAlign: 'right' }}>
      <Tooltip title={tooltip}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: 'monospace', userSelect: 'all' }}
        >
          {`UI ${ui}${short(uiSha) ? ` (${short(uiSha)})` : ''}${server ? ` · ${server}` : ''}`}
        </Typography>
      </Tooltip>
    </Box>
  )
}
