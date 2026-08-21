import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = (await request.json()) as { area?: string; name?: string; role?: string }
  const name = body.name?.trim() || '浅野隆史'
  const role = body.role?.trim() || '管理職'
  const area = body.area?.trim() || '栃木・茨城エリア'

  const response = NextResponse.json({ ok: true })
  response.cookies.set('genba-user-name', name, { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 7 })
  response.cookies.set('genba-user-role', role, { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 7 })
  response.cookies.set('genba-user-area', area, { path: '/', httpOnly: false, maxAge: 60 * 60 * 24 * 7 })

  return response
}
