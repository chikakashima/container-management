import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Building2,
  Camera,
  ClipboardList,
  PackageCheck,
  ShieldAlert,
  TimerReset,
  Truck,
  Users,
} from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { StatCard } from '@/components/stat-card'
import { getAlerts, getExecutiveSummary, getSites } from '@/lib/data'

export default async function HomePage() {
  const [sites, alerts, summary] = await Promise.all([getSites(), getAlerts(), getExecutiveSummary()])
  const activeSites = sites.filter((site) => site.status !== '完了').length
  const actionNeeded = alerts.filter((alert) => alert.status !== '完了').length
  const checkedToday = summary.safeCheckCount
  const completedThisMonth = summary.completedCount

  const menuTiles = [
    {
      href: '/dashboard',
      title: '今日の現場',
      value: `${activeSites}件`,
      body: '今動いている現場を確認',
      icon: Building2,
      tone: 'border-emerald-700 bg-emerald-50 text-emerald-900',
    },
    {
      href: '/alerts',
      title: '要対応',
      value: `${actionNeeded}件`,
      body: '先に電話・確認する現場',
      icon: ShieldAlert,
      tone: 'border-rose-700 bg-rose-50 text-rose-900',
    },
    {
      href: '/upload',
      title: '写真登録',
      value: '送る',
      body: '写真・動画を現場ごとに保存',
      icon: Camera,
      tone: 'border-sky-700 bg-sky-50 text-sky-900',
    },
    {
      href: '/containers',
      title: 'コンテナ管理',
      value: '一発',
      body: '現在設置・回収履歴・長期設置',
      icon: PackageCheck,
      tone: 'border-teal-700 bg-teal-50 text-teal-900',
    },
    {
      href: '/reports/new',
      title: '日報登録',
      value: '入力',
      body: '作業内容と問題点を記録',
      icon: ClipboardList,
      tone: 'border-amber-700 bg-amber-50 text-amber-900',
    },
    {
      href: '/executive',
      title: '社長画面',
      value: `${completedThisMonth}件`,
      body: '完了・遅延・要対応を確認',
      icon: BarChart3,
      tone: 'border-slate-700 bg-slate-50 text-slate-900',
    },
    {
      href: '/users',
      title: 'ユーザー管理',
      value: '管理',
      body: '社長・管理職・職人を確認',
      icon: Users,
      tone: 'border-indigo-700 bg-indigo-50 text-indigo-900',
    },
  ]

  return (
    <AppShell
      title="ホーム画面"
      description="管理職が朝の5分で、どの現場が順調で、どこに電話が必要かを把握するための入口です。"
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="進行中の現場" value={activeSites} helper="今日動いている現場数です。" icon={<Building2 className="h-7 w-7" />} />
          <StatCard label="要対応" value={actionNeeded} helper="先に見た方がよい現場です。" icon={<ShieldAlert className="h-7 w-7" />} />
          <StatCard label="確認済み" value={checkedToday} helper="今日の確認が終わった現場数です。" icon={<TimerReset className="h-7 w-7" />} />
          <StatCard label="今月完了" value={completedThisMonth} helper="今月引き渡し完了した件数です。" icon={<Truck className="h-7 w-7" />} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {menuTiles.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex min-h-52 flex-col justify-between border-l-8 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(15,23,42,0.12)] ${item.tone}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="border border-current bg-white/70 p-3">
                    <Icon className="h-8 w-8" />
                  </div>
                  <ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" />
                </div>
                <div>
                  <p className="text-4xl font-black leading-none">{item.value}</p>
                  <h2 className="mt-4 text-2xl font-black text-slate-950">{item.title}</h2>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{item.body}</p>
                </div>
              </Link>
            )
          })}
        </section>
      </div>
    </AppShell>
  )
}
