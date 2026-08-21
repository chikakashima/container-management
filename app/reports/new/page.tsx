import { AppShell } from '@/components/app-shell'
import { ReportForm } from '@/components/report-form'
import { getDailyReports, getSites } from '@/lib/data'

export default async function NewReportPage() {
  const [sites, reports] = await Promise.all([getSites(), getDailyReports()])

  return (
    <AppShell title="日報登録" description="夕方にスマホから短時間で入力できる日報画面です。">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ReportForm sites={sites} />
        <section className="panel rounded-none p-5">
          <h2 className="text-xl font-black text-slate-900">今日の日報見本</h2>
          <div className="mt-4 space-y-4">
            {reports.map((report) => {
              const site = sites.find((item) => item.id === report.siteId)

              return (
                <article key={report.id} className="rounded-none border border-slate-200 p-4">
                  <p className="text-base font-black text-slate-900">{site?.name}</p>
                  <p className="mt-2 text-sm text-slate-700">{report.workSummary}</p>
                  <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                    <p>時間: {report.startTime} - {report.endTime}</p>
                    <p>人数: {report.workersCount}人</p>
                  </div>
                  <p className="mt-3 rounded-none bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">問題点: {report.issueText}</p>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

