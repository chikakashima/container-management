import {
  mockAlerts,
  mockDailyReports,
  mockExecutiveSummary,
  mockMediaFiles,
  mockSites,
  mockSiteScores,
  mockUsers,
} from '@/data/mock-data'
import { getSupabaseClient, isSupabaseEnabled } from '@/lib/supabase'
import type {
  AlertRecord,
  DailyReportRecord,
  ExecutiveSummary,
  MediaFileRecord,
  SiteRecord,
  SiteScoreRecord,
  UserRecord,
} from '@/lib/types'

type SupabaseUser = {
  id: string
  name: string
  role: UserRecord['role']
  phone: string | null
  assigned_area: string | null
}

type SupabaseSite = {
  id: string
  name: string
  address: string
  manager_name: string
  supervisor_name: string
  start_date: string
  due_date: string
  status: SiteRecord['status']
  note: string | null
  progress_label: string | null
  latest_report: string | null
  latest_photo: string | null
  checked_today: boolean
  completion_rate: number | null
}

type SupabaseMediaFile = {
  id: string
  site_id: string
  file_type: MediaFileRecord['type']
  title: string
  comment: string | null
  work_type: string | null
  urgency: MediaFileRecord['urgency']
  uploaded_at: string
  file_url: string
}

type SupabaseDailyReport = {
  id: string
  site_id: string
  start_time: string
  end_time: string
  work_summary: string
  workers_count: number
  material_shortage: boolean
  issue_text: string | null
  tomorrow_plan: string | null
  photo_url: string | null
}

type SupabaseAlert = {
  id: string
  site_id: string
  alert_type: AlertRecord['type']
  title: string
  detail: string
  status: AlertRecord['status']
  created_at: string
}

type SupabaseSiteScore = {
  site_id: string
  score: SiteScoreRecord['score']
  label: string
  reason: string | null
}

async function fetchTable<T>(table: string): Promise<T[] | null> {
  if (!isSupabaseEnabled) return null

  const client = getSupabaseClient()
  if (!client) return null

  const { data, error } = await client.from(table).select('*')
  if (error || !data) return null

  return data as T[]
}

export async function getUsers(): Promise<UserRecord[]> {
  const data = await fetchTable<SupabaseUser>('users')
  if (!data) return mockUsers

  return data.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.role,
    phone: user.phone ?? '',
    assignedArea: user.assigned_area ?? '',
  }))
}

export async function getSites(): Promise<SiteRecord[]> {
  const [sites, scores] = await Promise.all([
    fetchTable<SupabaseSite>('sites'),
    fetchTable<SupabaseSiteScore>('site_scores'),
  ])
  if (!sites) return mockSites

  return sites.map((site) => {
    const score = scores?.find((item) => item.site_id === site.id)

    return {
      id: site.id,
      name: site.name,
      address: site.address,
      managerName: site.manager_name,
      supervisorName: site.supervisor_name,
      startDate: site.start_date,
      dueDate: site.due_date,
      status: site.status,
      note: site.note ?? '',
      progressLabel: site.progress_label ?? '進捗未入力',
      latestReport: site.latest_report ?? 'まだ報告はありません。',
      latestPhoto:
        site.latest_photo ??
        'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=1200&q=80',
      checkedToday: site.checked_today,
      score: score?.score ?? 3,
      completionRate: site.completion_rate ?? 0,
    }
  })
}

export async function getMediaFiles(): Promise<MediaFileRecord[]> {
  const data = await fetchTable<SupabaseMediaFile>('media_files')
  if (!data) return mockMediaFiles

  return data.map((file) => ({
    id: file.id,
    siteId: file.site_id,
    type: file.file_type,
    title: file.title,
    comment: file.comment ?? '',
    workType: file.work_type ?? '',
    urgency: file.urgency,
    uploadedAt: file.uploaded_at,
    url: file.file_url,
  }))
}

export async function getDailyReports(): Promise<DailyReportRecord[]> {
  const data = await fetchTable<SupabaseDailyReport>('daily_reports')
  if (!data) return mockDailyReports

  return data.map((report) => ({
    id: report.id,
    siteId: report.site_id,
    startTime: report.start_time,
    endTime: report.end_time,
    workSummary: report.work_summary,
    workersCount: report.workers_count,
    materialShortage: report.material_shortage,
    issueText: report.issue_text ?? '',
    tomorrowPlan: report.tomorrow_plan ?? '',
    photoUrl: report.photo_url ?? '',
  }))
}

export async function getAlerts(): Promise<AlertRecord[]> {
  const data = await fetchTable<SupabaseAlert>('alerts')
  if (!data) return mockAlerts

  return data.map((alert) => ({
    id: alert.id,
    siteId: alert.site_id,
    type: alert.alert_type,
    title: alert.title,
    detail: alert.detail,
    status: alert.status,
    createdAt: alert.created_at,
  }))
}

export async function getSiteScores(): Promise<SiteScoreRecord[]> {
  const data = await fetchTable<SupabaseSiteScore>('site_scores')
  if (!data) return mockSiteScores

  return data.map((score) => ({
    siteId: score.site_id,
    score: score.score,
    label: score.label,
    reason: score.reason ?? '',
  }))
}

export async function getExecutiveSummary(): Promise<ExecutiveSummary> {
  if (!isSupabaseEnabled) return mockExecutiveSummary

  const sites = await getSites()
  const alerts = await getAlerts()

  return {
    monthSiteCount: sites.length,
    completedCount: sites.filter((site) => site.status === '完了').length,
    delayedCount: alerts.filter((alert) => alert.type === '遅延').length,
    actionNeededCount: alerts.filter((alert) => alert.status !== '完了').length,
    safeCheckCount: sites.filter((site) => site.checkedToday).length,
  }
}

export async function getSiteById(id: string) {
  const [sites, mediaFiles, dailyReports, alerts, siteScores] = await Promise.all([
    getSites(),
    getMediaFiles(),
    getDailyReports(),
    getAlerts(),
    getSiteScores(),
  ])

  const site = sites.find((item) => item.id === id)
  if (!site) return null

  return {
    site,
    mediaFiles: mediaFiles.filter((item) => item.siteId === id),
    dailyReports: dailyReports.filter((item) => item.siteId === id),
    alerts: alerts.filter((item) => item.siteId === id),
    score: siteScores.find((item) => item.siteId === id) ?? null,
  }
}
