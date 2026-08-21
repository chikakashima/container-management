import { AppShell } from '@/components/app-shell'
import { SiteStatusBadge } from '@/components/status-badge'
import { StatCard } from '@/components/stat-card'
import { getExecutiveSummary, getSites } from '@/lib/data'
import { Building2, CheckCheck, ShieldCheck, Siren, TriangleAlert } from 'lucide-react'

export default async function ExecutivePage() {
  const [summary, sites] = await Promise.all([getExecutiveSummary(), getSites()])

  return (
    <AppShell title="社長ダッシュボード" description="社長が全体件数、遅延、要対応を短時間で把握できる画面です。">
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="今月の現場数" value={summary.monthSiteCount} helper="登録済みの稼働案件です。" icon={<Building2 className="h-7 w-7" />} />
          <StatCard label="完了件数" value={summary.completedCount} helper="引き渡しまで終えた件数です。" icon={<CheckCheck className="h-7 w-7" />} />
          <StatCard label="遅延件数" value={summary.delayedCount} helper="工期ずれの注意件数です。" icon={<TriangleAlert className="h-7 w-7" />} />
          <StatCard label="要対応件数" value={summary.actionNeededCount} helper="誰かが対応すべき件数です。" icon={<Siren className="h-7 w-7" />} />
          <StatCard label="安全確認件数" value={summary.safeCheckCount} helper="今日確認済みにした件数です。" icon={<ShieldCheck className="h-7 w-7" />} />
        </section>

        <section className="panel rounded-none p-5">
          <h2 className="text-xl font-black text-slate-900">現場別ステータス一覧</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-3 py-3 font-bold">現場名</th>
                  <th className="px-3 py-3 font-bold">担当者</th>
                  <th className="px-3 py-3 font-bold">進捗</th>
                  <th className="px-3 py-3 font-bold">状態</th>
                  <th className="px-3 py-3 font-bold">確認</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.id} className="border-b border-slate-100">
                    <td className="px-3 py-4 font-bold text-slate-900">{site.name}</td>
                    <td className="px-3 py-4 text-slate-700">{site.managerName}</td>
                    <td className="px-3 py-4 text-slate-700">{site.progressLabel}</td>
                    <td className="px-3 py-4"><SiteStatusBadge status={site.status} /></td>
                    <td className="px-3 py-4 text-slate-700">{site.checkedToday ? '確認済み' : '未確認'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  )
}

