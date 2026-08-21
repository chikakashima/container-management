import { ContainerManagement } from '@/components/container-management'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/50 bg-[linear-gradient(135deg,#0c4e46_0%,#157868_55%,#edf7f3_100%)] text-white">
        <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
          <p className="text-xs font-bold tracking-[0.22em] text-emerald-100">CONTAINER MANAGEMENT</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">コンテナ管理システム</h1>
          <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-emerald-50 sm:text-base">
            紙の作業日報を入力すると、現在の設置状況・長期設置アラート・収集履歴へ自動で反映します。
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <ContainerManagement />
      </main>
    </div>
  )
}
