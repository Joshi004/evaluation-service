import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiFetch, type LeaderboardRow } from '../client'
import { queryKeys } from './queryKeys'

export function useLeaderboard(): UseQueryResult<LeaderboardRow[]> {
  return useQuery({
    queryKey: queryKeys.leaderboard(),
    queryFn: () => apiFetch<LeaderboardRow[]>('/leaderboard'),
  })
}
