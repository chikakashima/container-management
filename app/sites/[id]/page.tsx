import Image from 'next/image'
import { notFound } from 'next/navigation'
import { AlertBadge, SiteStatusBadge } from '@/components/status-badge'
import { AppShell } from '@/components/app-shell'
import { getSiteById } from '@/lib/data'
import { formatDate, formatDateTime, renderStars } from '@/lib/format'

export default async function SiteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getSiteById(id)

  if (!detail) notFound()

  const { site, alerts, dailyReports, mediaFiles, score } = detail

  return (
    <AppShell title="現場詳細" description="最新写真、日報、危険情報、進捗を1つの現場ごとにまとめて確認できます。">
      <div className="space-y-6">
        <section className="panel overflow-hidden rounded-none">
          <div className="relative h-72">
            <Image src={site.latestPhoto} alt={site.name} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="flex flex-wrap items-center gap-3">
                <SiteStatusBadge status={site.status} />
                <span className="rounded-none bg-white/15 px-3 py-1 text-sm font-bold backdrop-blur">{site.progressLabel}</span>
              </div>
              <h2 className="mt-3 text-3xl font-black">{site.name}</h2>
              <p className="mt-2 text-sm text-white/85">{site.address}</p>
            </div>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-none bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">担当者</p>
              <p className="mt-2 text-lg font-black text-slate-900">{site.managerName}</p>
            </div>
            <div className="rounded-none bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">現場責任者</p>
              <p className="mt-2 text-lg font-black text-slate-900">{site.supervisorName}</p>
            </div>
            <div className="rounded-none bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">工期</p>
              <p className="mt-2 text-lg font-black text-slate-900">{formatDate(site.startDate)} - {formatDate(site.dueDate)}</p>
            </div>
            <div className="rounded-none bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-500">現場スコア</p>
              <p className="mt-2 text-lg font-black text-slate-900">{score ? `${renderStars(score.score)} ${score.label.replace(`${renderStars(score.score)} `, '')}` : '未計算'}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
          <article className="panel rounded-none p-5">
            <h3 className="text-xl font-black text-slate-900">最新の報告と日報</h3>
            <div className="mt-4 space-y-4">
              {dailyReports.map((report) => (
                <div key={report.id} className="rounded-none border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-base font-black text-slate-900">{report.workSummary}</p>
                    <span className="rounded-none bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">{report.startTime} - {report.endTime}</span>
                  </div>
                  <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                    <p><span className="font-bold">人数:</span> {report.workersCount}人</p>
                    <p><span className="font-bold">材料不足:</span> {report.materialShortage ? 'あり' : 'なし'}</p>
                  </div>
                  <p className="mt-3 rounded-none bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"><span className="font-bold">問題点:</span> {report.issueText}</p>
                  <p className="mt-3 rounded-none bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900"><span className="font-bold">明日の予定:</span> {report.tomorrowPlan}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="panel rounded-none p-5">
            <h3 className="text-xl font-black text-slate-900">要対応と最新写真</h3>
            <div className="mt-4 space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="rounded-none border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <AlertBadge type={alert.type} />
                    <span className="text-sm font-bold text-slate-500">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  <p className="mt-3 text-base font-black text-slate-900">{alert.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{alert.detail}</p>
                </div>
              ))}
              <div className="grid gap-4">
                {mediaFiles.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-none border border-slate-200">
                    <div className="relative h-52">
                      <Image src={item.url} alt={item.title} fill className="object-cover" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-base font-black text-slate-900">{item.title}</p>
                        <span className="text-sm font-bold text-slate-500">{formatDateTime(item.uploadedAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{item.comment}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>
      </div>
    </AppShell>
  )
}

