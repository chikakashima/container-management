import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { AlertType, SiteStatus } from '@/lib/types'

export function formatDate(dateText: string) {
  return format(new Date(dateText), 'M月d日', { locale: ja })
}

export function formatDateTime(dateText: string) {
  return format(new Date(dateText), 'M月d日 HH:mm', { locale: ja })
}

export function getStatusTone(status: SiteStatus) {
  switch (status) {
    case '順調':
      return 'bg-emerald-100 text-emerald-800'
    case '要確認':
      return 'bg-amber-100 text-amber-800'
    case '応援必要':
      return 'bg-rose-100 text-rose-800'
    case '雨天中止':
      return 'bg-sky-100 text-sky-800'
    case '完了':
      return 'bg-slate-200 text-slate-700'
  }
}

export function getAlertTone(type: AlertType) {
  switch (type) {
    case '材料不足':
    case '遅延':
      return 'bg-amber-100 text-amber-800'
    case '応援必要':
    case '危険あり':
      return 'bg-rose-100 text-rose-800'
    case '未確認':
      return 'bg-sky-100 text-sky-800'
    case '雨天中止':
      return 'bg-slate-200 text-slate-700'
  }
}

export function renderStars(score: number) {
  return `${'★'.repeat(score)}${'☆'.repeat(5 - score)}`
}

