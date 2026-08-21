import Link from 'next/link'
import { cookies } from 'next/headers'
import { Building2, Camera, ClipboardList, LayoutDashboard, PackageCheck, Siren, Users } from 'lucide-react'
import type { ReactNode } from 'react'

const menu = [
  { href: '/', label: 'ホーム', icon: LayoutDashboard },
  { href: '/dashboard', label: '今日の現場', icon: Building2 },
  { href: '/containers', label: 'コンテナ', icon: PackageCheck },
  { href: '/upload', label: '写真登録', icon: Camera },
  { href: '/reports/new', label: '日報登録', icon: ClipboardList },
  { href: '/alerts', label: '要対応', icon: Siren },
  { href: '/users', label: 'ユーザー', icon: Users },
]

export async function AppShell({
  children,
  title,
  description,
}: {
  children: ReactNode
  title: string
  description: string
}) {
  const cookieStore = await cookies()
  const userName = '浅野隆史'
  const userRole = cookieStore.get('genba-user-role')?.value ?? '管理職'
  const userArea = '栃木・茨城エリア'

  return (
    <div className="app-shell">
      <header className="border-b border-white/50 bg-[linear-gradient(135deg,#0c4e46_0%,#157868_52%,#e6f2ee_52%,#f7fbfa_100%)] text-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm font-bold tracking-[0.22em] text-emerald-100">GENBA MIERUKA ASSIST</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-50 sm:text-base">{description}</p>
            </div>
            <div className="rounded-none border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/90 backdrop-blur">
              現場へ行かなくても、現場が分かる。
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="panel rounded-none p-4">
          <div className="mb-4 rounded-none bg-[linear-gradient(135deg,#0f6a5f,#1f8f55)] p-4 text-white">
            <p className="text-xs tracking-[0.18em] text-emerald-50">ログイン中</p>
            <p className="mt-2 text-xl font-bold">{userName}</p>
            <p className="mt-1 text-sm text-emerald-50">{userRole} / {userArea}</p>
          </div>
          <nav className="space-y-2">
            {menu.map((item) => {
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-none px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  )
}
