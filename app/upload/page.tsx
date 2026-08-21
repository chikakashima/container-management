import { AppShell } from '@/components/app-shell'
import { UploadForm } from '@/components/upload-form'
import { getMediaFiles, getSites } from '@/lib/data'
import { formatDateTime } from '@/lib/format'

export default async function UploadPage() {
  const [sites, mediaFiles] = await Promise.all([getSites(), getMediaFiles()])

  return (
    <AppShell title="写真・動画アップロード" description="職人または現場責任者がスマホから写真や動画を入れられる画面です。">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <UploadForm sites={sites} />
        <section className="panel rounded-none p-5">
          <h2 className="text-xl font-black text-slate-900">最近のアップロード</h2>
          <div className="mt-4 space-y-4">
            {mediaFiles.map((item) => (
              <article key={item.id} className="rounded-none border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.workType}</p>
                  </div>
                  <span className="rounded-none bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700">{item.urgency}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700">{item.comment}</p>
                <p className="mt-2 text-sm font-bold text-slate-500">{formatDateTime(item.uploadedAt)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  )
}

