'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SiteRecord } from '@/lib/types'

export function UploadForm({ sites }: { sites: SiteRecord[] }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [workType, setWorkType] = useState('')
  const [urgency, setUrgency] = useState('中')
  const [uploadedAt, setUploadedAt] = useState('')

  const previewUrl = useMemo(() => {
    if (!selectedFile) return null
    return URL.createObjectURL(selectedFile)
  }, [selectedFile])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  return (
    <form
      className="panel rounded-none p-5"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!selectedFile) {
          setMessage('先に写真または動画を選んでください。')
          return
        }

        setIsSubmitting(true)
        setMessage('')

        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('siteId', selectedSiteId)
        formData.append('title', title || selectedFile.name)
        formData.append('comment', comment)
        formData.append('workType', workType)
        formData.append('urgency', urgency)
        formData.append('uploadedAt', uploadedAt || new Date().toISOString())

        const response = await fetch('/api/media-upload', {
          method: 'POST',
          body: formData,
        })
        const data = (await response.json()) as { message: string }
        setMessage(data.message)
        setIsSubmitting(false)
      }}
    >
      <div className="mb-4">
        <h3 className="text-xl font-black text-slate-900">写真・動画アップロード</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">職人の方がスマホで迷わないよう、入力項目を最小限にしています。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          現場を選ぶ
          <select
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            value={selectedSiteId}
            onChange={(event) => setSelectedSiteId(event.target.value)}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          緊急度
          <select
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            value={urgency}
            onChange={(event) => setUrgency(event.target.value)}
          >
            <option value="低">低</option>
            <option value="中">中</option>
            <option value="高">高</option>
            <option value="緊急">緊急</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          写真または動画
          <input
            type="file"
            accept="image/*,video/*"
            className="w-full rounded-none border border-slate-200 bg-white px-4 py-3"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          タイトル
          <input
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：天井下地確認"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          作業内容
          <input
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：外壁補修"
            value={workType}
            onChange={(event) => setWorkType(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700">
          アップロード日時
          <input
            type="datetime-local"
            className="w-full rounded-none border border-slate-200 px-4 py-3"
            value={uploadedAt}
            onChange={(event) => setUploadedAt(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          コメント
          <textarea
            className="min-h-28 w-full rounded-none border border-slate-200 px-4 py-3"
            placeholder="例：塗料がまだ届いていません"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </label>
      </div>

      {previewUrl ? (
        <div className="mt-5 rounded-none border border-dashed border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">アップ前の確認</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="preview" className="mt-3 h-52 w-full rounded-none object-cover" />
        </div>
      ) : null}

      <button
        type="submit"
        className="mt-5 w-full rounded-none bg-emerald-700 px-4 py-4 text-base font-black text-white disabled:bg-emerald-300"
        disabled={isSubmitting}
      >
        {isSubmitting ? '登録中です...' : '写真・動画を登録する'}
      </button>

      {message ? <p className="mt-4 rounded-none bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{message}</p> : null}
    </form>
  )
}
