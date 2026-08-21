import { AppShell } from '@/components/app-shell'
import { getUsers } from '@/lib/data'

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <AppShell title="ユーザー管理" description="社長、管理職、現場責任者、職人の権限を分けて運用するための画面です。">
      <section className="panel rounded-none p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-3 font-bold">氏名</th>
                <th className="px-3 py-3 font-bold">役割</th>
                <th className="px-3 py-3 font-bold">電話</th>
                <th className="px-3 py-3 font-bold">担当エリア</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-slate-100">
                  <td className="px-3 py-4 font-bold text-slate-900">{user.name}</td>
                  <td className="px-3 py-4 text-slate-700">{user.role}</td>
                  <td className="px-3 py-4 text-slate-700">{user.phone}</td>
                  <td className="px-3 py-4 text-slate-700">{user.assignedArea}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
}

