import { NextResponse } from 'next/server'
import { getSupabaseClient, isSupabaseEnabled } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()

  if (!body.name || !body.address || !body.managerName || !body.startDate || !body.dueDate) {
    return NextResponse.json({ message: '現場名、住所、担当者、開始日、完了予定日は必須です。' }, { status: 400 })
  }

  if (!isSupabaseEnabled) {
    return NextResponse.json({
      message: '見本モードで現場登録を受け付けました。Supabase接続後は一覧へ実保存されます。',
    })
  }

  const client = getSupabaseClient()
  if (!client) {
    return NextResponse.json({ message: 'Supabase接続に失敗しました。' }, { status: 500 })
  }

  const result = await client.from('sites').insert({
    name: body.name,
    address: body.address,
    manager_name: body.managerName,
    supervisor_name: body.supervisorName || body.managerName,
    start_date: body.startDate,
    due_date: body.dueDate,
    status: body.status || '順調',
    note: body.note || '',
    progress_label: body.progressLabel || '着工前',
    latest_report: body.latestReport || 'まだ報告はありません。',
    latest_photo:
      body.latestPhoto ||
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80',
    checked_today: false,
    completion_rate: Number(body.completionRate ?? 0),
  })

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Supabaseへ現場を登録しました。' })
}

