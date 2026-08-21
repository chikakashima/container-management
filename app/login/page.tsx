import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="panel w-full max-w-md rounded-none p-6 sm:p-8">
        <p className="text-sm font-bold tracking-[0.18em] text-emerald-700">GENBA MIERUKA ASSIST</p>
        <h1 className="mt-3 text-3xl font-black text-slate-900">ログイン</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">社長、管理職、現場責任者、職人の4つに分けて使える設計です。</p>

        <LoginForm />
      </section>
    </main>
  )
}
