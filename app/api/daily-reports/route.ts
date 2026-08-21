import { NextResponse } from 'next/server'
import { getSupabaseClient, isSupabaseEnabled } from '@/lib/supabase'

export async function POST(request: Request) {
  const body = await request.json()

  if (!body.siteId || !body.workSummary) {
    return NextResponse.json({ message: '現場名と作業内容は必須です。' }, { status: 400 })
  }

  if (!isSupabaseEnabled) {
    return NextResponse.json({
      message: '見本モードで日報を受け付けました。Supabase接続後は実保存に切り替わります。',
    })
  }

  const client = getSupabaseClient()
  if (!client) {
    return NextResponse.json({ message: 'Supabase接続に失敗しました。' }, { status: 500 })
  }

  const result = await client.from('daily_reports').insert({
    site_id: body.siteId,
    start_time: body.startTime,
    end_time: body.endTime,
    work_summary: body.workSummary,
    workers_count: Number(body.workersCount ?? 1),
    material_shortage: body.materialShortage,
    issue_text: body.issueText,
    tomorrow_plan: body.tomorrowPlan,
  })

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Supabaseへ日報を保存しました。' })
}

