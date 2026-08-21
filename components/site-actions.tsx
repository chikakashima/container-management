'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CircleCheckBig, TriangleAlert } from 'lucide-react'

export function SiteActions({ siteId }: { siteId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submitAction = async (action: 'checked' | 'needs_action') => {
    setIsSubmitting(true)
    setMessage('')

    const response = await fetch('/api/site-actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ siteId, action }),
    })
    const data = (await response.json()) as { message: string }

    setMessage(data.message)
    setIsSubmitting(false)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => submitAction('checked')}
          className="inline-flex items-center gap-2 rounded-none bg-sky-600 px-4 py-3 text-sm font-bold text-white disabled:bg-sky-300"
        >
          <CircleCheckBig className="h-4 w-4" />
          確認済み
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => submitAction('needs_action')}
          className="inline-flex items-center gap-2 rounded-none bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:bg-rose-300"
        >
          <TriangleAlert className="h-4 w-4" />
          要対応
        </button>
      </div>
      {message ? <p className="text-xs font-bold text-slate-600">{message}</p> : null}
    </div>
  )
}

