import Link from 'next/link'
import { AppShell } from '@/components/app-shell'
import { AlertBadge, SiteStatusBadge } from '@/components/status-badge'
import { getAlerts, getSites } from '@/lib/data'
import { formatDateTime } from '@/lib/format'

export default async function AlertsPage() {
  const [alerts, sites] = await Promise.all([getAlerts(), getSites()])

  return (
    <AppShell title="要対応一覧" description="材料不足、応援必要、遅延、危険、未確認など、先に見るべき現場だけを並べています。">
      <section className="panel rounded-none p-5">
        <div className="grid gap-4">
          {alerts.map((alert) => {
            const site = sites.find((item) => item.id === alert.siteId)
            if (!site) return null

            return (
              <article key={alert.id} className="rounded-none border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertBadge type={alert.type} />
                    <SiteStatusBadge status={site.status} />
                  </div>
                  <span className="text-sm font-bold text-slate-500">{formatDateTime(alert.createdAt)}</span>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="text-xl font-black text-slate-900">{alert.title}</p>
                    <p className="mt-2 text-sm font-bold text-slate-500">{site.name}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{alert.detail}</p>
                  </div>
                  <Link href={`/sites/${site.id}`} className="rounded-none bg-rose-600 px-4 py-3 text-center text-sm font-bold text-white">
                    現場詳細を見る
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </AppShell>
  )
}

