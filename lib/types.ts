export type UserRole = '社長' | '管理職' | '現場責任者' | '職人'

export type SiteStatus = '順調' | '要確認' | '応援必要' | '雨天中止' | '完了'

export type AlertType =
  | '材料不足'
  | '応援必要'
  | '遅延'
  | '危険あり'
  | '未確認'
  | '雨天中止'

export type Urgency = '低' | '中' | '高' | '緊急'

export type UserRecord = {
  id: string
  name: string
  role: UserRole
  phone: string
  assignedArea: string
}

export type SiteRecord = {
  id: string
  name: string
  address: string
  managerName: string
  supervisorName: string
  startDate: string
  dueDate: string
  status: SiteStatus
  note: string
  progressLabel: string
  latestReport: string
  latestPhoto: string
  checkedToday: boolean
  score: 1 | 2 | 3 | 4 | 5
  completionRate: number
}

export type MediaFileRecord = {
  id: string
  siteId: string
  type: 'photo' | 'video'
  title: string
  comment: string
  workType: string
  urgency: Urgency
  uploadedAt: string
  url: string
}

export type DailyReportRecord = {
  id: string
  siteId: string
  startTime: string
  endTime: string
  workSummary: string
  workersCount: number
  materialShortage: boolean
  issueText: string
  tomorrowPlan: string
  photoUrl: string
}

export type AlertRecord = {
  id: string
  siteId: string
  type: AlertType
  title: string
  detail: string
  status: '未対応' | '確認中' | '完了'
  createdAt: string
}

export type SiteScoreRecord = {
  siteId: string
  score: 1 | 2 | 3 | 4 | 5
  label: string
  reason: string
}

export type ExecutiveSummary = {
  monthSiteCount: number
  completedCount: number
  delayedCount: number
  actionNeededCount: number
  safeCheckCount: number
}

