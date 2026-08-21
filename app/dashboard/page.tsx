import { Building2, CircleAlert, CircleCheckBig, Clock3 } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { SiteCard } from '@/components/site-card'
import { StatCard } from '@/components/stat-card'
import { getAlerts, getSites } from '@/lib/data'

export default async function DashboardPage() {
  const [sites, alerts] = await Promise.all([getSites(), getAlerts()])

  return (
    <AppShell
      title="今日の現場一覧"
      description="管理職がスマホで見た時に、今日の現場状況が5分で分かる画面です。"
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="順調" value={sites.filter((site) => site.status === '順調').length} helper="予定通り進んでいます。" icon={<CircleCheckBig className="h-7 w-7" />} />
          <StatCard label="要確認" value={sites.filter((site) => site.status === '要確認').length} helper="電話確認をしたい現場です。" icon={<CircleAlert className="h-7 w-7" />} />
          <StatCard label="応援必要" value={sites.filter((site) => site.status === '応援必要').length} helper="人員調整が必要です。" icon={<Building2 className="h-7 w-7" />} />
          <StatCard label="未確認" value={alerts.filter((alert) => alert.type === '未確認').length} helper="まだ見ていない現場です。" icon={<Clock3 className="h-7 w-7" />} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </section>
      </div>
    </AppShell>
  )
}

