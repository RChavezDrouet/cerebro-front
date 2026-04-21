import { useQuery } from '@tanstack/react-query'

import { useTenantContext } from '@/hooks/useTenantContext'
import type { DashboardPeriod } from '@/lib/dashboard/hrDashboard'
import { loadDashboardData } from '@/lib/dashboard/biDashboard'

export function useDashboardAnalytics(userId: string | undefined, period: DashboardPeriod) {
  const tenantContext = useTenantContext(userId)
  const tenantId = tenantContext.data?.tenantId

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-bi', tenantId, period],
    enabled: Boolean(tenantId),
    queryFn: () => loadDashboardData(tenantId!, period),
    placeholderData: (previousData) => previousData,
    retry: false,
    staleTime: 60_000,
  })

  return {
    tenantId,
    tenantStatus: tenantContext.data?.tenantStatus,
    tenantLoading: tenantContext.isLoading,
    ...dashboardQuery,
  }
}
