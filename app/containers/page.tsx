import { ContainerManagement } from '@/components/container-management'
import { AppShell } from '@/components/app-shell'

export default function ContainersPage() {
  return (
    <AppShell
      title="コンテナ管理"
      description="作業日報を1回入力したら、現在設置・入力ミス確認・長期設置アラート・帳票出力へ自動反映します。"
    >
      <ContainerManagement />
    </AppShell>
  )
}
