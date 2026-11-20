import { useQuery } from '@tanstack/react-query'
import { authApi, type Whoami } from './api/auth'

/** Identity of the signed-in user (drives admin UI + edit permissions). */
export function useWhoami() {
  const { data } = useQuery({
    queryKey: ['whoami'],
    queryFn: authApi.whoami,
    staleTime: 300_000,
    retry: false,
  })
  return {
    me: data as Whoami | undefined,
    isAdmin: data?.role === 'admin',
  }
}
