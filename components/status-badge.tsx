import { getAlertTone, getStatusTone } from '@/lib/format'
import type { AlertType, SiteStatus } from '@/lib/types'

export function SiteStatusBadge({ status }: { status: SiteStatus }) {
  return <span className={`rounded-none px-3 py-1 text-sm font-bold ${getStatusTone(status)}`}>{status}</span>
}

export function AlertBadge({ type }: { type: AlertType }) {
  return <span className={`rounded-none px-3 py-1 text-sm font-bold ${getAlertTone(type)}`}>{type}</span>
}

