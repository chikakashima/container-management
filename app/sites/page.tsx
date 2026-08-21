import { AppShell } from '@/components/app-shell'
import { SiteForm } from '@/components/site-form'
import { SiteStatusBadge } from '@/components/status-badge'
import { getSites } from '@/lib/data'
import { formatDate } from '@/lib/format'

export default async function SitesPage() {
  const sites = await getSites()

  return (
    <AppShell title="現場管理" description="現場の登録、担当者、工期、状態を1画面で見られるようにしています。">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SiteForm />
        <section className="panel rounded-none p-5">
          <h2 className="text-xl font-black text-slate-900">登録済み現場</h2>
          <div className="mt-4 space-y-4">
            {sites.map((site) => (
              <article key={site.id} className="rounded-none border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{site.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{site.address}</p>
                  </div>
                  <SiteStatusBadge status={site.status} />
                </div>
                <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                  <p><span className="font-bold">担当者:</span> {site.managerName}</p>
                  <p><span className="font-bold">開始日:</span> {formatDate(site.startDate)}</p>
                  <p><span className="font-bold">完了予定:</span> {formatDate(site.dueDate)}</p>
                </div>
                <p className="mt-3 rounded-none bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{site.note}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

