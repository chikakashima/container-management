import Image from 'next/image'
import Link from 'next/link'
import { formatDate, renderStars } from '@/lib/format'
import type { SiteRecord } from '@/lib/types'
import { SiteStatusBadge } from './status-badge'
import { SiteActions } from './site-actions'

export function SiteCard({ site }: { site: SiteRecord }) {
  return (
    <article className="panel overflow-hidden rounded-none">
      <div className="relative h-52">
        <Image src={site.latestPhoto} alt={site.name} fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <SiteStatusBadge status={site.status} />
            <span className="rounded-none bg-white/15 px-3 py-1 text-sm font-bold backdrop-blur">
              {site.completionRate}% 完了
            </span>
          </div>
          <h3 className="mt-3 text-xl font-black">{site.name}</h3>
          <p className="mt-1 text-sm text-white/85">{site.progressLabel}</p>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <div>
            <p className="font-bold text-slate-500">担当者</p>
            <p className="mt-1">{site.managerName}</p>
          </div>
          <div>
            <p className="font-bold text-slate-500">完了予定</p>
            <p className="mt-1">{formatDate(site.dueDate)}</p>
          </div>
        </div>
        <div className="rounded-none bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-500">最新報告</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{site.latestReport}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-slate-800">
            {renderStars(site.score)} <span className="ml-2">{site.status}</span>
          </div>
          <SiteActions siteId={site.id} />
        </div>
        <Link
          href={`/sites/${site.id}`}
          className="block rounded-none border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
        >
          詳細を見る
        </Link>
      </div>
    </article>
  )
}
