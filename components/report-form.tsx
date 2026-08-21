'use client'

import { useState } from 'react'
import type { SiteRecord } from '@/lib/types'

export function ReportForm({ sites }: { sites: SiteRecord[] }) {
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [workersCount, setWorkersCount] = useState('1')
  const [materialShortage, setMaterialShortage] = useState('なし')
  const [workSummary, setWorkSummary] = useState('')
  const [issueText, setIssueText] = useState('')
  const [tomorrowPlan, setTomorrowPlan] = useState('')

  return (
    <form
      className="panel rounded-none p-5"
      onSubmit={async (event) => {
        event.preventDefault()
        setIsSubmitting(true)
        setMessage('')

        const response = await fetch('/api/daily-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            siteId,
            startTime,
            endTime,
            workersCount,
            materialShortage: materialShortage === 'あり',
            workSummary,
            issueText,
            tomorrowPlan,
          }),
        })
        const data = (await response.json()) as { message: string }
        setMessage(data.message)
        setIsSubmitting(false)
      }}
    >
      <div className="mb-4">
        <h3 className="text-xl font-black text-slate-900">日報登録</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">夕方に2分で終わるよう、現場で必要な項目だけに絞っています。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          現場名
          <select
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          作業開始時間
          <input type="time" className="w-full rounded-none border border-slate-200 px-4 py-3" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          作業終了時間
          <input type="time" className="w-full rounded-none border border-slate-200 px-4 py-3" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          人数
          <input type="number" min="1" className="w-full rounded-none border border-slate-200 px-4 py-3" placeholder="例：4" value={workersCount} onChange={(event) => setWorkersCount(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          材料不足
          <select className="w-full rounded-none border border-slate-200 px-4 py-3" value={materialShortage} onChange={(event) => setMaterialShortage(event.target.value)}>
            <option value="なし">なし</option>
            <option value="あり">あり</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          作業内容
          <textarea className="min-h-28 w-full rounded-none border border-slate-200 px-4 py-3" placeholder="例：天井下地、壁ボード張り" value={workSummary} onChange={(event) => setWorkSummary(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          問題点
          <textarea className="min-h-24 w-full rounded-none border border-slate-200 px-4 py-3" placeholder="例：塗料の残量が不足気味" value={issueText} onChange={(event) => setIssueText(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          明日の予定
          <textarea className="min-h-24 w-full rounded-none border border-slate-200 px-4 py-3" placeholder="例：壁面仕上げ、開口部納まり確認" value={tomorrowPlan} onChange={(event) => setTomorrowPlan(event.target.value)} />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          写真添付
          <input type="file" accept="image/*" className="w-full rounded-none border border-slate-200 bg-white px-4 py-3" />
        </label>
      </div>

      <button type="submit" className="mt-5 w-full rounded-none bg-emerald-700 px-4 py-4 text-base font-black text-white disabled:bg-emerald-300" disabled={isSubmitting}>
        {isSubmitting ? '登録中です...' : '日報を登録する'}
      </button>

      {message ? <p className="mt-4 rounded-none bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{message}</p> : null}
    </form>
  )
}
