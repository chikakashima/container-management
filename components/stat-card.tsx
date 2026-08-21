import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string
  value: string | number
  helper: string
  icon: ReactNode
}) {
  return (
    <section className="panel rounded-none p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
        </div>
        <div className="rounded-none bg-emerald-50 p-3 text-emerald-700">{icon}</div>
      </div>
    </section>
  )
}

