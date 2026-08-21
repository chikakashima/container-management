import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '現場見える化アシスト',
  description: '建築・内装・太陽光施工会社向けの現場見える化システム',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}

