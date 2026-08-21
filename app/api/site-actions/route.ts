import { NextResponse } from 'next/server'
import { getSupabaseClient, isSupabaseEnabled } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()
  const siteId = String(body.siteId ?? '')
  const action = String(body.action ?? '')

  if (!siteId || !action) {
    return NextResponse.json({ message: '現場と操作内容が不足しています。' }, { status: 400 })
  }

  if (!isSupabaseEnabled) {
    return NextResponse.json({
      message: action === 'checked' ? '見本モードで確認済みにしました。' : '見本モードで要対応にしました。',
    })
  }

  const client = getSupabaseClient()
  if (!client) {
    return NextResponse.json({ message: 'Supabase接続に失敗しました。' }, { status: 500 })
  }

  if (action === 'checked') {
    const result = await client.from('sites').update({ checked_today: true }).eq('id', siteId)

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ message: '確認済みにしました。' })
  }

  if (action === 'needs_action') {
    const result = await client.from('alerts').insert({
      site_id: siteId,
      alert_type: '未確認',
      title: '管理職が要対応にしました',
      detail: '現場カードから要対応として登録されました。',
      status: '未対応',
    })

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 })
    }

    return NextResponse.json({ message: '要対応一覧へ追加しました。' })
  }

  return NextResponse.json({ message: '対応していない操作です。' }, { status: 400 })
}

