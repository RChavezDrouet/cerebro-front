import React from 'react'

import { Badge } from '@/components/ui/Badge'
import type { ApprovalOverallStatus } from '@/features/approvals/types'
import { getRequestStatusLabel, getRequestStatusTone } from '../utils'

export function RequestStatusBadge({ status }: { status: ApprovalOverallStatus }) {
  return <Badge tone={getRequestStatusTone(status)}>{getRequestStatusLabel(status)}</Badge>
}
