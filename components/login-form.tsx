'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const [name, setName] = useState('浅野隆史')
  const [email, setEmail] = useState('asano@example.com')
  const [area, setArea] = useState('栃木・茨城エリア')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('管理職')
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (event) => {
        event.preventDefault()
        setIsSubmitting(true)
        await fetch('/api/demo-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, role, area, email, password }),
        })
        router.push('/')
        router.refresh()
      }}
    >
      <label className="block space-y-2 text-sm font-bold text-slate-700">
        氏名
        <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-none border border-slate-200 px-4 py-4" placeholder="例：浅野隆史" />
      </label>
      <label className="block space-y-2 text-sm font-bold text-slate-700">
        メールアドレス
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-none border border-slate-200 px-4 py-4" placeholder="name@example.com" />
      </label>
      <label className="block space-y-2 text-sm font-bold text-slate-700">
        パスワード
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-none border border-slate-200 px-4 py-4" placeholder="••••••••" />
      </label>
      <label className="block space-y-2 text-sm font-bold text-slate-700">
        担当エリア
        <input value={area} onChange={(event) => setArea(event.target.value)} className="w-full rounded-none border border-slate-200 px-4 py-4" placeholder="例：栃木・茨城エリア" />
      </label>
      <label className="block space-y-2 text-sm font-bold text-slate-700">
        ユーザー種別
        <select value={role} onChange={(event) => setRole(event.target.value)} className="w-full rounded-none border border-slate-200 px-4 py-4">
          <option>社長</option>
          <option>管理職</option>
          <option>現場責任者</option>
          <option>職人</option>
        </select>
      </label>
      <button type="submit" disabled={isSubmitting} className="block w-full rounded-none bg-emerald-700 px-4 py-4 text-center text-base font-black text-white disabled:bg-emerald-300">
        {isSubmitting ? 'ログイン中です...' : 'ログインする'}
      </button>
    </form>
  )
}
