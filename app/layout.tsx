import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'コンテナ管理システム',
  description: '産業廃棄物のコンテナ設置・引上げ・長期設置・収集履歴を一元管理',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
