import type { ContainerReport } from '@/lib/container-data'

export type LedgerLifecycleRow = {
  id: string
  installedOn: string | null
  collectedOn: string | null
  companyName: string
  siteName: string
  quantity: number
}

type OpenQuantity = {
  id: string
  installedOn: string
  companyName: string
  siteName: string
  customerId: string
  siteId: string
  remaining: number
}

export function buildQuantityLedgerRows(reports: ContainerReport[]): LedgerLifecycleRow[] {
  const sortedReports = [...reports].sort((a, b) => {
    const dateOrder = a.workDate.localeCompare(b.workDate)
    if (dateOrder !== 0) return dateOrder
    return (a.entryOrder ?? 0) - (b.entryOrder ?? 0)
  })
  const open: OpenQuantity[] = []
  const completed: LedgerLifecycleRow[] = []

  for (const report of sortedReports) {
    let collectRemaining = report.basketCollectCount ?? 0

    while (collectRemaining > 0) {
      const lot = open.find((item) =>
        item.remaining > 0
        && item.customerId === (report.customerId ?? '')
        && item.siteId === (report.siteId ?? ''),
      )
      if (!lot) break

      const quantity = Math.min(lot.remaining, collectRemaining)
      completed.push({
        id: `${lot.id}-collected-${report.id}-${quantity}`,
        installedOn: lot.installedOn,
        collectedOn: report.workDate,
        companyName: lot.companyName,
        siteName: lot.siteName,
        quantity,
      })
      lot.remaining -= quantity
      collectRemaining -= quantity
    }

    if (collectRemaining > 0) {
      completed.push({
        id: `unknown-install-${report.id}`,
        installedOn: null,
        collectedOn: report.workDate,
        companyName: report.companyName,
        siteName: report.siteName,
        quantity: collectRemaining,
      })
    }

    const installCount = report.basketInstallCount ?? 0
    if (installCount > 0) {
      open.push({
        id: report.id,
        installedOn: report.workDate,
        companyName: report.companyName,
        siteName: report.siteName,
        customerId: report.customerId ?? '',
        siteId: report.siteId ?? '',
        remaining: installCount,
      })
    }
  }

  const active = open.filter((item) => item.remaining > 0).map((item) => ({
    id: `${item.id}-active`,
    installedOn: item.installedOn,
    collectedOn: null,
    companyName: item.companyName,
    siteName: item.siteName,
    quantity: item.remaining,
  }))

  return [...completed, ...active].sort((a, b) => {
    const aDate = a.installedOn ?? a.collectedOn ?? ''
    const bDate = b.installedOn ?? b.collectedOn ?? ''
    return aDate.localeCompare(bDate)
  })
}
