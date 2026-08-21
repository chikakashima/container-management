'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { SiteStatus } from '@/lib/types'

export function SiteForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [managerName, setManagerName] = useState('')
  const [supervisorName, setSupervisorName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<SiteStatus>('順調')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      className="panel rounded-none p-5"
      onSubmit={async (event) => {
        event.preventDefault()
        setIsSubmitting(true)
        setMessage('')

        const response = await fetch('/api/sites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            address,
            managerName,
            supervisorName,
            startDate,
            dueDate,
            status,
            note,
          }),
        })
        const data = (await response.json()) as { message: string }
        setMessage(data.message)
        setIsSubmitting(false)

        if (response.ok) {
          setName('')
          setAddress('')
          setManagerName('')
          setSupervisorName('')
          setStartDate('')
          setDueDate('')
          setStatus('順調')
          setNote('')
          router.refresh()
        }
      }}
    >
      <div className="mb-4">
        <h3 className="text-xl font-black text-slate-900">現場登録</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">まずは現場名、担当者、日程を入れれば運用を始められます。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          現場名
          <input
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：INAMITU 小山店 改装工事"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          担当者
          <input
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：浅野隆史"
            value={managerName}
            onChange={(event) => setManagerName(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          現場責任者
          <input
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：田中 翔"
            value={supervisorName}
            onChange={(event) => setSupervisorName(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          住所
          <input
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：栃木県小山市駅東通り..."
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          開始日
          <input
            type="date"
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          完了予定日
          <input
            type="date"
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          ステータス
          <select
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            value={status}
            onChange={(event) => setStatus(event.target.value as SiteStatus)}
          >
            <option value="順調">順調</option>
            <option value="要確認">要確認</option>
            <option value="応援必要">応援必要</option>
            <option value="雨天中止">雨天中止</option>
            <option value="完了">完了</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          備考
          <textarea
            className="min-h-28 w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：引き渡し前の確認事項"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        className="mt-5 w-full rounded-none bg-emerald-700 px-4 py-4 text-base font-black text-white disabled:bg-emerald-300"
        disabled={isSubmitting}
      >
        {isSubmitting ? '登録中です...' : '現場を登録する'}
      </button>
      {message ? <p className="mt-4 rounded-none bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{message}</p> : null}
    </form>
  )
}
