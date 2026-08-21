import { NextResponse } from 'next/server'
import { getSupabaseClient, isSupabaseEnabled } from '@/lib/supabase'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')
  const siteId = String(formData.get('siteId') ?? '')
  const title = String(formData.get('title') ?? '')
  const comment = String(formData.get('comment') ?? '')
  const workType = String(formData.get('workType') ?? '')
  const urgency = String(formData.get('urgency') ?? '中')
  const uploadedAt = String(formData.get('uploadedAt') ?? new Date().toISOString())

  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'ファイルが選ばれていません。' }, { status: 400 })
  }

  if (!isSupabaseEnabled) {
    return NextResponse.json({
      message: '見本モードで受付しました。Supabase接続後は実保存に切り替わります。',
      url: null,
    })
  }

  const client = getSupabaseClient()
  if (!client) {
    return NextResponse.json({ message: 'Supabase接続に失敗しました。' }, { status: 500 })
  }

  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'site-media'
  const extension = file.name.split('.').pop() ?? 'bin'
  const path = `${siteId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
  const arrayBuffer = await file.arrayBuffer()

  const uploadResult = await client.storage.from(bucket).upload(path, arrayBuffer, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })

  if (uploadResult.error) {
    return NextResponse.json({ message: uploadResult.error.message }, { status: 500 })
  }

  const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(path)
  const fileType = file.type.startsWith('video') ? 'video' : 'photo'

  const insertResult = await client.from('media_files').insert({
    site_id: siteId,
    file_type: fileType,
    title,
    comment,
    work_type: workType,
    urgency,
    uploaded_at: uploadedAt,
    file_url: publicUrlData.publicUrl,
  })

  if (insertResult.error) {
    return NextResponse.json({ message: insertResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Supabaseへ保存しました。',
    url: publicUrlData.publicUrl,
  })
}

