'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Database, KeyRound, LogOut, PackageCheck, Plus, Printer, RotateCcw, Search, Trash2, Truck } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import {
  longTermThresholds,
  type ContainerAssignment,
  type ContainerReport,
  type ContainerWorkType,
  type LongTermThreshold,
  type BasketBalance,
  type CustomerMaster,
  type SiteMaster,
} from '@/lib/container-data'

type ReportRow = {
  id: string
  entryType: 'container' | 'basket'
  basketType: string
  customerId: string
  companyName: string
  siteId: string
  siteName: string
  installAssetId: string
  collectAssetId: string
  basketInstallCount: string
  basketCollectCount: string
  quantityNote: string
}

type AppTab = 'daily' | 'container-ledger' | 'collection-history' | 'masters'
type PrintTarget = 'container-ledger' | 'collection-history' | null

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '設置日不明'
  const [year, month, day] = value.split('-')
  return `${year}/${Number(month)}/${Number(day)}`
}

function daysFrom(value: string | null | undefined) {
  if (!value) return null
  const start = new Date(`${value}T12:00:00`).getTime()
  const end = new Date(`${today()}T12:00:00`).getTime()
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\s　]/g, '')
}

function emptyRow(id = `row-${Date.now()}-${Math.random()}`): ReportRow {
  return {
    id, entryType: 'container', basketType: 'カゴ', customerId: '', companyName: '', siteId: '', siteName: '',
    installAssetId: '', collectAssetId: '', basketInstallCount: '', basketCollectCount: '', quantityNote: '',
  }
}

function defaultRows(): ReportRow[] {
  return [emptyRow('row-1'), emptyRow('row-2'), emptyRow('row-3')]
}

function workType(row: ReportRow): ContainerWorkType {
  if (row.entryType === 'basket') {
    if (Number(row.basketInstallCount) > 0 && Number(row.basketCollectCount) > 0) return '交換'
    if (Number(row.basketInstallCount) > 0) return '設置'
    if (Number(row.basketCollectCount) > 0) return '回収'
    return '手積み'
  }
  if (row.installAssetId && row.collectAssetId) return '交換'
  if (row.installAssetId) return '設置'
  if (row.collectAssetId) return '回収'
  return '手積み'
}

function hasContent(row: ReportRow) {
  return Boolean(row.companyName.trim() || row.siteName.trim() || row.installAssetId || row.collectAssetId || row.basketInstallCount || row.basketCollectCount || row.quantityNote.trim())
}

function customerOption(customer: CustomerMaster) {
  return `${customer.customerCode}｜${customer.name}${customer.nameKana ? `｜${customer.nameKana}` : ''}`
}

function siteOption(site: SiteMaster) {
  return `${site.siteCode}｜${site.name}${site.nameKana ? `｜${site.nameKana}` : ''}`
}

function normalizeAssetIdentifier(value: string) {
  return value
    .replace(/^container-/i, '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s　]/g, '')
    .replace(/番$/u, '')
    .replace(/[^A-Z0-9]/g, '')
}

function asset(assetId: string) {
  if (!assetId) return undefined
  const identifier = normalizeAssetIdentifier(assetId)
  return identifier
    ? { id: `container-${identifier.toLowerCase()}`, label: identifier, assetType: 'コンテナ' as const, sizeLabel: '' }
    : undefined
}

function assetIdentifier(assetId: string) {
  return asset(assetId)?.label ?? ''
}

function typeColor(type: ContainerWorkType) {
  if (type === '交換') return 'bg-violet-100 text-violet-800'
  if (type === '設置') return 'bg-emerald-100 text-emerald-800'
  if (type === '回収') return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-800'
}

const PAGE_SIZE = 500

function reportFromRow(item: Record<string, unknown>): ContainerReport {
  return {
    id: String(item.id), workDate: String(item.work_date), companyName: String(item.company_name), siteName: String(item.site_name),
    driverName: String(item.driver_name), workType: item.work_type as ContainerWorkType,
    installAssetId: item.install_asset_id ? String(item.install_asset_id) : undefined,
    installAssetLabel: item.install_asset_label ? String(item.install_asset_label) : undefined,
    collectAssetId: item.collect_asset_id ? String(item.collect_asset_id) : undefined,
    collectAssetLabel: item.collect_asset_label ? String(item.collect_asset_label) : undefined,
    assetType: item.asset_type as ContainerReport['assetType'], sizeLabel: String(item.size_label),
    quantity: String(item.quantity), note: item.note ? String(item.note) : undefined,
    customerId: item.customer_id ? String(item.customer_id) : undefined,
    siteId: item.site_id ? String(item.site_id) : undefined,
    basketInstallCount: Number(item.basket_install_count ?? 0),
    basketCollectCount: Number(item.basket_collect_count ?? 0),
    entryOrder: Number(item.entry_order ?? 0),
  }
}

type PasswordChangeFormProps = {
  loading: boolean
  error: string
  newPassword: string
  confirm: string
  onPassword: (value: string) => void
  onConfirm: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

function PasswordChangeForm({ loading, error, newPassword, confirm, onPassword, onConfirm, onSubmit }: PasswordChangeFormProps) {
  return (
    <form className="mt-5 space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-bold">新しいパスワード<input type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full border border-slate-300 px-4 py-3" value={newPassword} onChange={(event) => onPassword(event.target.value)} /></label>
      <label className="block text-sm font-bold">新しいパスワード（確認）<input type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full border border-slate-300 px-4 py-3" value={confirm} onChange={(event) => onConfirm(event.target.value)} /></label>
      {error ? <p className="bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p> : null}
      <button disabled={loading} className="w-full bg-emerald-800 px-4 py-3 font-black text-white disabled:opacity-60">{loading ? '変更中…' : 'パスワードを変更'}</button>
    </form>
  )
}

export function ContainerManagement() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [forgotPassword, setForgotPassword] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [stored, setStored] = useState<{ assignments: ContainerAssignment[]; reports: ContainerReport[]; thresholds: LongTermThreshold[] }>({ assignments: [], reports: [], thresholds: longTermThresholds })
  const [workDate, setWorkDate] = useState(today())
  const [driverName, setDriverName] = useState('')
  const [rows, setRows] = useState<ReportRow[]>(defaultRows)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [companyQuery, setCompanyQuery] = useState('')
  const [containerQuery, setContainerQuery] = useState('')
  const [activeTab, setActiveTab] = useState<AppTab>('daily')
  const [ledgerAssetId, setLedgerAssetId] = useState('')
  const [ledgerAssetQuery, setLedgerAssetQuery] = useState('')
  const [historyCompany, setHistoryCompany] = useState('')
  const [historyYear, setHistoryYear] = useState(String(new Date().getFullYear()))
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null)
  const [companyOptions, setCompanyOptions] = useState<string[]>([])
  const [assetOptions, setAssetOptions] = useState<Array<{ id: string; label: string; assetType: 'コンテナ' | 'カゴ'; sizeLabel: string }>>([])
  const [ledgerRows, setLedgerRows] = useState<ContainerReport[]>([])
  const [historyRows, setHistoryRows] = useState<ContainerReport[]>([])
  const [sheetLoading, setSheetLoading] = useState(false)
  const [customers, setCustomers] = useState<CustomerMaster[]>([])
  const [sites, setSites] = useState<SiteMaster[]>([])
  const [basketBalances, setBasketBalances] = useState<BasketBalance[]>([])
  const [masterReady, setMasterReady] = useState(true)
  const [customerCode, setCustomerCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerKana, setCustomerKana] = useState('')
  const [siteCustomerId, setSiteCustomerId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [siteName, setSiteName] = useState('')
  const [siteKana, setSiteKana] = useState('')
  const [masterMessage, setMasterMessage] = useState('')

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        setShowPasswordChange(true)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    void loadFromSupabase()
  }, [session])

  async function loadFromSupabase() {
    setLoading(true)
    setErrors([])
    const assignments: ContainerAssignment[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const result = await supabase.from('container_assignments').select('*').is('collected_on', null)
        .order('installed_on', { ascending: false }).range(from, from + PAGE_SIZE - 1)
      if (result.error) {
        setErrors([result.error.message || 'データを読み込めませんでした。'])
        setLoading(false)
        return
      }
      assignments.push(...(result.data ?? []).map((item) => ({
        id: item.id, assetId: item.asset_id, assetLabel: item.asset_label, assetType: item.asset_type,
        sizeLabel: item.size_label, companyName: item.company_name, siteName: item.site_name,
        installedOn: item.installed_on ? String(item.installed_on) : null, collectedOn: undefined, quantity: item.quantity, note: item.note ?? undefined,
        customerId: item.customer_id ?? undefined, siteId: item.site_id ?? undefined,
      })))
      if ((result.data?.length ?? 0) < PAGE_SIZE) break
    }
    async function loadPages(table: 'container_customers' | 'container_sites' | 'basket_balances', columns: string) {
      const data: Array<Record<string, unknown>> = []
      for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase.from(table).select(columns)
        if (table === 'basket_balances') query = query.gt('quantity', 0)
        const result = await query.order(table === 'basket_balances' ? 'company_name' : 'name').range(from, from + PAGE_SIZE - 1)
        if (result.error) return { data, error: result.error }
        data.push(...((result.data ?? []) as unknown as Array<Record<string, unknown>>))
        if ((result.data?.length ?? 0) < PAGE_SIZE) break
      }
      return { data, error: null }
    }
    const [customersResult, sitesResult, basketResult] = await Promise.all([
      loadPages('container_customers', 'id,customer_code,name,name_kana'),
      loadPages('container_sites', 'id,customer_id,site_code,name,name_kana'),
      loadPages('basket_balances', 'id,customer_id,site_id,company_name,site_name,basket_type,quantity'),
    ])
    const mastersAvailable = !customersResult.error && !sitesResult.error && !basketResult.error
    setMasterReady(mastersAvailable)
    if (mastersAvailable) {
      setCustomers(customersResult.data.map((item) => ({ id: String(item.id), customerCode: String(item.customer_code), name: String(item.name), nameKana: String(item.name_kana) })))
      setSites(sitesResult.data.map((item) => ({ id: String(item.id), customerId: String(item.customer_id), siteCode: String(item.site_code), name: String(item.name), nameKana: String(item.name_kana) })))
      setBasketBalances(basketResult.data.map((item) => ({ id: String(item.id), customerId: String(item.customer_id), siteId: String(item.site_id), companyName: String(item.company_name), siteName: String(item.site_name), basketType: String(item.basket_type), quantity: Number(item.quantity) })))
    }
    setStored({ assignments, reports: [], thresholds: longTermThresholds })
    setLoading(false)
  }

  const active = useMemo(() => stored.assignments.filter((item) => !item.collectedOn), [stored.assignments])
  const longTerm = useMemo(
    () => active.flatMap((item) => {
      const elapsedDays = daysFrom(item.installedOn)
      return elapsedDays === null ? [] : [{ ...item, elapsedDays }]
    })
      .sort((a, b) => b.elapsedDays - a.elapsedDays),
    [active],
  )
  const searchResults = useMemo(() => {
    if (containerQuery.trim()) return active.filter((item) => normalize(item.assetLabel).includes(normalize(containerQuery)))
    if (companyQuery.trim()) return active.filter((item) => {
      const customer = customers.find((option) => option.id === item.customerId || normalize(option.name) === normalize(item.companyName))
      return [item.companyName, customer?.customerCode ?? '', customer?.nameKana ?? ''].some((value) => normalize(value).includes(normalize(companyQuery)))
    })
    return active
  }, [active, companyQuery, containerQuery, customers])
  const basketSearchResults = useMemo(() => {
    if (containerQuery.trim()) return []
    if (!companyQuery.trim()) return basketBalances
    const query = normalize(companyQuery)
    return basketBalances.filter((item) => {
      const customer = customers.find((option) => option.id === item.customerId)
      return [item.companyName, customer?.customerCode ?? '', customer?.nameKana ?? '']
        .some((value) => normalize(value).includes(query))
    })
  }, [basketBalances, companyQuery, containerQuery, customers])
  const years = useMemo(() => Array.from({ length: 11 }, (_, index) => String(new Date().getFullYear() + 1 - index)), [])
  const selectedAsset = asset(ledgerAssetId)

  useEffect(() => {
    if (!session || !ledgerAssetQuery.trim()) return
    const timer = window.setTimeout(async () => {
      const identifier = normalizeAssetIdentifier(ledgerAssetQuery)
      const result = await supabase.from('container_assets').select('id,label,asset_type,size_label')
        .ilike('label', `%${identifier}%`).limit(30)
      if (!result.error) setAssetOptions((result.data ?? []).map((item) => ({ id: item.id, label: item.label, assetType: item.asset_type, sizeLabel: item.size_label })))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [ledgerAssetQuery, session])

  useEffect(() => {
    if (!session || historyCompany.trim().length < 1) return
    if (masterReady && customers.length) {
      const query = normalize(historyCompany)
      const timer = window.setTimeout(() => {
        setCompanyOptions(customers.filter((customer) =>
          [customer.customerCode, customer.name, customer.nameKana].some((value) => normalize(value).includes(query)),
        ).slice(0, 30).map((customer) => customer.name))
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(async () => {
      const result = await supabase.from('container_reports').select('company_name')
        .ilike('company_name', `%${historyCompany.trim()}%`).limit(200)
      if (!result.error) setCompanyOptions(Array.from(new Set((result.data ?? []).map((item) => item.company_name))).slice(0, 30))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [customers, historyCompany, masterReady, session])

  useEffect(() => {
    if (!session || !ledgerAssetId) return
    let cancelled = false
    void (async () => {
      setSheetLoading(true)
      const reports: ContainerReport[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const result = await supabase.from('container_reports').select('*')
          .or(`install_asset_id.eq.${ledgerAssetId},collect_asset_id.eq.${ledgerAssetId}`)
          .order('work_date', { ascending: true }).range(from, from + PAGE_SIZE - 1)
        if (result.error || cancelled) break
        reports.push(...(result.data ?? []).map(reportFromRow))
        if ((result.data?.length ?? 0) < PAGE_SIZE) break
      }
      if (!cancelled) {
        setLedgerRows(reports)
        setSheetLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [ledgerAssetId, session])

  useEffect(() => {
    if (!session || !historyCompany.trim() || !historyYear) return
    let cancelled = false
    void (async () => {
      setSheetLoading(true)
      const reports: ContainerReport[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const result = await supabase.from('container_reports').select('*').eq('company_name', historyCompany.trim())
          .gte('work_date', `${historyYear}-01-01`).lte('work_date', `${historyYear}-12-31`)
          .order('work_date', { ascending: true }).order('entry_order', { ascending: true }).range(from, from + PAGE_SIZE - 1)
        if (result.error || cancelled) break
        reports.push(...(result.data ?? []).map(reportFromRow))
        if ((result.data?.length ?? 0) < PAGE_SIZE) break
      }
      if (!cancelled) {
        setHistoryRows(reports)
        setSheetLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [historyCompany, historyYear, session])

  function printSheet(target: Exclude<PrintTarget, null>) {
    setPrintTarget(target)
    window.setTimeout(() => {
      window.print()
      setPrintTarget(null)
    }, 80)
  }

  function selectLedgerAsset(value: string) {
    setLedgerAssetQuery(value)
    if (!value.trim()) {
      setLedgerAssetId('')
      setLedgerRows([])
      setAssetOptions([])
      return
    }
    const exact = assetOptions.find((item) => item.label === value || `${item.label}（${item.sizeLabel}・${item.assetType}）` === value)
    if (exact) setLedgerAssetId(exact.id)
    else {
      const identifier = normalizeAssetIdentifier(value)
      setLedgerAssetId(identifier ? `container-${identifier.toLowerCase()}` : '')
    }
  }

  function updateRow(id: string, patch: Partial<ReportRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function updateCustomer(rowId: string, value: string) {
    const exact = customers.find((customer) => value === customerOption(customer) || value === customer.name || value === customer.customerCode)
    updateRow(rowId, exact
      ? { customerId: exact.id, companyName: exact.name, siteId: '', siteName: '' }
      : { customerId: '', companyName: value, siteId: '', siteName: '' })
  }

  function updateSite(rowId: string, customerId: string, value: string) {
    const exact = sites.find((site) => site.customerId === customerId && (value === siteOption(site) || value === site.name || value === site.siteCode))
    updateRow(rowId, exact ? { siteId: exact.id, siteName: exact.name } : { siteId: '', siteName: value })
  }

  function buildPlan(inputRows: ReportRow[]) {
    const next: string[] = []
    const movements = new Map<string, {
      asset: NonNullable<ReturnType<typeof asset>>
      install?: { row: ReportRow; line: number }
      collect?: { row: ReportRow; line: number }
    }>()

    inputRows.forEach((row, index) => {
      const line = index + 1
      const install = row.entryType === 'container' ? asset(row.installAssetId) : undefined
      const collect = row.entryType === 'container' ? asset(row.collectAssetId) : undefined
      const basketInstall = Number(row.basketInstallCount || 0)
      const basketCollect = Number(row.basketCollectCount || 0)

      if (!row.companyName.trim()) next.push(`${line}行目：排出事業者名を入力してください。`)
      if (masterReady && customers.length && !row.customerId) next.push(`${line}行目：登録済みの排出事業者を候補から選択してください。`)
      if (row.siteName.trim() && row.siteName.trim() !== '同左' && masterReady && row.customerId && !row.siteId) {
        next.push(`${line}行目：登録済みの現場を候補から選択してください。`)
      }
      if (workType(row) !== '設置' && !row.quantityNote.trim()) next.push(`${line}行目：受託数量・備考を入力してください。`)

      if (row.entryType === 'basket') {
        if (!row.basketType.trim()) next.push(`${line}行目：カゴ等の種類を入力してください。`)
        if (!Number.isInteger(basketInstall) || !Number.isInteger(basketCollect) || basketInstall < 0 || basketCollect < 0) {
          next.push(`${line}行目：カゴの設置・引上げは0以上の整数で入力してください。`)
        }
        if (basketInstall === 0 && basketCollect === 0) next.push(`${line}行目：カゴの設置または引上げ台数を入力してください。`)
        if (!masterReady || !row.customerId || !row.siteId) next.push(`${line}行目：カゴは登録済みの排出事業者と現場を選択してください。`)
        return
      }

      if (!install && !collect && !row.quantityNote.trim()) next.push(`${line}行目：設置・引上げ・受託数量のいずれかを入力してください。`)
      if (row.installAssetId === row.collectAssetId && row.installAssetId) next.push(`${line}行目：設置と引上げは別の番号にしてください。`)

      if (install) {
        const movement = movements.get(install.id) ?? { asset: install }
        if (movement.install) next.push(`${line}行目：${install.label}の設置が同じ日報内で重複しています。`)
        else movement.install = { row, line }
        movements.set(install.id, movement)
      }
      if (collect) {
        const movement = movements.get(collect.id) ?? { asset: collect }
        if (movement.collect) next.push(`${line}行目：${collect.label}の引上げが同じ日報内で重複しています。`)
        else movement.collect = { row, line }
        movements.set(collect.id, movement)
      }
    })

    movements.forEach(({ asset: targetAsset, install, collect }) => {
      const current = active.find((item) => item.assetId === targetAsset.id)
      if (current) {
        if (collect) {
          if (normalize(current.companyName) !== normalize(collect.row.companyName)) {
            next.push(`${collect.line}行目：${current.assetLabel}は別の排出事業者（${current.companyName}）に設置中です。`)
            return
          }
          if (current.siteId && collect.row.siteId && current.siteId !== collect.row.siteId) {
            next.push(`${collect.line}行目：${current.assetLabel}は別の現場（${current.siteName}）に設置中です。`)
            return
          }
        }
      } else if (collect && !install) {
        // Another driver's installation report for the same day may be entered later.
        // The database reconciliation keeps this as pending instead of rejecting it.
        return
      } else if (install && collect) {
        const sameCustomer = normalize(install.row.companyName) === normalize(collect.row.companyName)
        const sameSite = (install.row.siteId && collect.row.siteId)
          ? install.row.siteId === collect.row.siteId
          : normalize(install.row.siteName || '同左') === normalize(collect.row.siteName || '同左')
        if (!sameCustomer || !sameSite) {
          next.push(`${collect.line}行目：未設置の${targetAsset.label}を同日中に引上げる場合は、設置と同じ排出事業者・現場を指定してください。`)
          return
        }
      }

    })

    const basketGroups = new Map<string, { row: ReportRow; basketType: string; install: number; collect: number; line: number }>()
    inputRows.forEach((row, index) => {
      if (row.entryType !== 'basket' || !row.customerId || !row.siteId) return
      const basketType = row.basketType.trim()
      const key = `${row.customerId}:${row.siteId}:${basketType}`
      const current = basketGroups.get(key)
      basketGroups.set(key, {
        row,
        basketType,
        install: (current?.install ?? 0) + Number(row.basketInstallCount || 0),
        collect: (current?.collect ?? 0) + Number(row.basketCollectCount || 0),
        line: current?.line ?? index + 1,
      })
    })
    basketGroups.forEach((movement) => {
      const current = basketBalances.find((item) => item.customerId === movement.row.customerId && item.siteId === movement.row.siteId && item.basketType === movement.basketType)?.quantity ?? 0
      if (current + movement.install - movement.collect < 0) {
        next.push(`${movement.line}行目：カゴの引上げ台数が現在の設置台数（${current}台）を超えています。`)
      }
    })

    return { errors: Array.from(new Set(next)), basketGroups }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const inputRows = rows.filter(hasContent)
    const nextErrors: string[] = []
    if (!workDate) nextErrors.push('日付を入力してください。')
    if (!driverName.trim()) nextErrors.push('名前（ドライバー）を入力してください。')
    if (!inputRows.length) nextErrors.push('作業明細を1行以上入力してください。')
    const plan = buildPlan(inputRows)
    nextErrors.push(...plan.errors)
    setErrors(nextErrors)
    setMessage('')
    if (nextErrors.length) return

    const batch = Date.now()
    const reports: ContainerReport[] = inputRows.map((row, index) => {
      const install = row.entryType === 'container' ? asset(row.installAssetId) : undefined
      const collect = row.entryType === 'container' ? asset(row.collectAssetId) : undefined
      return {
        id: `report-${batch}-${index}`,
        workDate,
        customerId: row.customerId || undefined,
        companyName: row.companyName.trim(),
        siteId: row.siteId || undefined,
        siteName: row.siteName.trim() || '同左',
        driverName: driverName.trim(),
        workType: workType(row),
        installAssetId: install?.id,
        installAssetLabel: install?.label,
        collectAssetId: collect?.id,
        collectAssetLabel: collect?.label,
        assetType: row.entryType === 'basket' ? 'カゴ' : install?.assetType ?? collect?.assetType ?? '手積み',
        sizeLabel: row.entryType === 'basket' ? row.basketType.trim() : install?.sizeLabel ?? collect?.sizeLabel ?? '手積み',
        quantity: row.quantityNote.trim(),
        note: row.quantityNote.trim() || undefined,
        basketInstallCount: Number(row.basketInstallCount || 0),
        basketCollectCount: Number(row.basketCollectCount || 0),
        entryOrder: index + 1,
      }
    })

    setLoading(true)
    const usedAssets = new Map<string, NonNullable<ReturnType<typeof asset>>>()
    inputRows.filter((row) => row.entryType === 'container').forEach((row) => {
      const install = asset(row.installAssetId)
      const collect = asset(row.collectAssetId)
      if (install) usedAssets.set(install.id, install)
      if (collect) usedAssets.set(collect.id, collect)
    })
    const assetsResult = await supabase.from('container_assets').upsert(
      Array.from(usedAssets.values()).map((item) => ({ id: item.id, label: item.label, asset_type: item.assetType, size_label: item.sizeLabel })),
      { onConflict: 'id' },
    )
    if (assetsResult.error) {
      setErrors([`コンテナ情報を保存できませんでした：${assetsResult.error.message}`])
      setLoading(false)
      return
    }

    const reportsResult = await supabase.from('container_reports').insert(reports.map((item) => ({
      id: item.id, work_date: item.workDate, customer_id: item.customerId ?? null,
      company_name: item.companyName, site_id: item.siteId ?? null, site_name: item.siteName,
      driver_name: item.driverName, work_type: item.workType, install_asset_id: item.installAssetId ?? null,
      install_asset_label: item.installAssetLabel ?? null, collect_asset_id: item.collectAssetId ?? null,
      collect_asset_label: item.collectAssetLabel ?? null, asset_type: item.assetType, size_label: item.sizeLabel,
      quantity: item.quantity, note: item.note ?? null, basket_install_count: item.basketInstallCount ?? 0,
      basket_collect_count: item.basketCollectCount ?? 0, entry_order: item.entryOrder ?? 0,
    })))
    if (reportsResult.error) {
      setErrors([`日報を保存できませんでした：${reportsResult.error.message}`])
      setLoading(false)
      return
    }

    const affectedAssetIds = Array.from(usedAssets.keys())
    let pendingMessages: string[] = []
    if (affectedAssetIds.length) {
      const reconcileResult = await supabase.rpc('reconcile_container_day', {
        p_work_date: workDate,
        p_asset_ids: affectedAssetIds,
      })
      if (reconcileResult.error) {
        setErrors([`同日作業の設置状況を反映できませんでした：${reconcileResult.error.message}`])
        setLoading(false)
        return
      }
      pendingMessages = ((reconcileResult.data ?? []) as Array<{ asset_id: string; status: string }>)
        .filter((item) => item.status !== '反映済み')
        .map((item) => `${item.asset_id.replace('container-', '')}：${item.status}`)
    }

    const basketResults = await Promise.all(Array.from(plan.basketGroups.values()).map((movement) =>
      supabase.rpc('apply_basket_movement', {
        p_customer_id: movement.row.customerId,
        p_site_id: movement.row.siteId,
        p_company_name: movement.row.companyName.trim(),
        p_site_name: movement.row.siteName.trim(),
        p_install_count: movement.install,
        p_collect_count: movement.collect,
        p_basket_type: movement.basketType,
      }),
    ))
    const basketError = basketResults.find((result) => result.error)?.error
    if (basketError) {
      setErrors([`カゴの台数を保存できませんでした：${basketError.message}`])
      setLoading(false)
      return
    }

    await loadFromSupabase()
    setCompanyQuery(reports[0]?.companyName ?? '')
    setContainerQuery(reports[0]?.installAssetLabel ?? reports[0]?.collectAssetLabel ?? '')
    setRows([emptyRow(), emptyRow(), emptyRow()])
    setMessage(pendingMessages.length
      ? `${formatDate(workDate)}の日報を${reports.length}件登録しました。同日の別日報を待っている作業があります（${pendingMessages.join('、')}）。`
      : `${formatDate(workDate)}の日報を${reports.length}件登録し、管理表へ反映しました。`)
  }

  function reset() {
    setRows(defaultRows())
    setDriverName('')
    setErrors([])
    setMessage('入力内容をクリアしました。')
  }

  async function addCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMasterMessage('')
    setErrors([])
    if (!customerCode.trim() || !customerName.trim()) {
      setErrors(['顧客番号と排出事業者名を入力してください。'])
      return
    }
    setLoading(true)
    const result = await supabase.from('container_customers').insert({
      customer_code: customerCode.trim(),
      name: customerName.trim(),
      name_kana: customerKana.trim(),
    })
    if (result.error) {
      setErrors([result.error.code === '23505' ? '同じ顧客番号がすでに登録されています。' : `排出事業者を登録できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    setCustomerCode('')
    setCustomerName('')
    setCustomerKana('')
    await loadFromSupabase()
    setMasterMessage('排出事業者を登録しました。')
  }

  async function addSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMasterMessage('')
    setErrors([])
    if (!siteCustomerId || !siteCode.trim() || !siteName.trim()) {
      setErrors(['排出事業者、現場番号、現場名を入力してください。'])
      return
    }
    setLoading(true)
    const result = await supabase.from('container_sites').insert({
      customer_id: siteCustomerId,
      site_code: siteCode.trim(),
      name: siteName.trim(),
      name_kana: siteKana.trim(),
    })
    if (result.error) {
      setErrors([result.error.code === '23505' ? 'この排出事業者には同じ現場番号がすでに登録されています。' : `現場を登録できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    setSiteCode('')
    setSiteName('')
    setSiteKana('')
    await loadFromSupabase()
    setMasterMessage('現場を登録しました。')
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setAuthError('メールアドレスまたはパスワードが正しくありません。')
    setLoading(false)
  }

  async function sendPasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    setAuthMessage('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    })
    if (error) {
      setAuthError('再設定メールを送信できませんでした。メールアドレスをご確認ください。')
    } else {
      setAuthMessage('パスワード再設定メールを送信しました。メール内のリンクを開いてください。')
    }
    setLoading(false)
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    setAuthMessage('')
    if (newPassword.length < 8) {
      setAuthError('新しいパスワードは8文字以上で入力してください。')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setAuthError('確認用パスワードが一致しません。')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setAuthError('パスワードを変更できませんでした。時間をおいてもう一度お試しください。')
    } else {
      setNewPassword('')
      setNewPasswordConfirm('')
      setPasswordRecovery(false)
      setShowPasswordChange(false)
      setAuthMessage('パスワードを変更しました。')
      window.history.replaceState({}, '', window.location.pathname)
    }
    setLoading(false)
  }

  if (!authReady) return <div className="panel p-8 text-center font-bold">読み込み中です…</div>

  if (!session) return (
    <section className="panel mx-auto max-w-md rounded-none p-7">
      <div className="flex items-center gap-3"><Truck className="h-9 w-9 text-emerald-800" /><h2 className="text-2xl font-black">コンテナ管理システム</h2></div>
      <p className="mt-3 text-sm text-slate-600">{forgotPassword ? '登録済みのメールアドレスへ、パスワード再設定メールを送信します。' : '登録済みのメールアドレスとパスワードでログインしてください。'}</p>
      <form className="mt-6 space-y-4" onSubmit={forgotPassword ? sendPasswordReset : signIn}>
        <label className="block text-sm font-bold">メールアドレス<input type="email" autoComplete="email" required className="mt-2 w-full border border-slate-300 px-4 py-3" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {!forgotPassword ? <label className="block text-sm font-bold">パスワード<input type="password" autoComplete="current-password" required className="mt-2 w-full border border-slate-300 px-4 py-3" value={password} onChange={(event) => setPassword(event.target.value)} /></label> : null}
        {authError ? <p className="bg-rose-50 p-3 text-sm font-bold text-rose-800">{authError}</p> : null}
        {authMessage ? <p className="bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{authMessage}</p> : null}
        <button disabled={loading} className="w-full bg-emerald-800 px-4 py-4 font-black text-white disabled:opacity-60">{loading ? '確認中…' : forgotPassword ? '再設定メールを送信' : 'ログイン'}</button>
        <button type="button" className="w-full py-2 text-sm font-bold text-emerald-800 underline" onClick={() => { setForgotPassword((value) => !value); setAuthError(''); setAuthMessage('') }}>
          {forgotPassword ? 'ログイン画面に戻る' : 'パスワードを忘れた方'}
        </button>
      </form>
    </section>
  )

  if (passwordRecovery) return (
    <section className="panel mx-auto max-w-md rounded-none p-7">
      <div className="flex items-center gap-3"><KeyRound className="h-9 w-9 text-emerald-800" /><h2 className="text-2xl font-black">新しいパスワードを設定</h2></div>
      <p className="mt-3 text-sm text-slate-600">8文字以上の新しいパスワードを入力してください。</p>
      <PasswordChangeForm loading={loading} error={authError} newPassword={newPassword} confirm={newPasswordConfirm} onPassword={setNewPassword} onConfirm={setNewPasswordConfirm} onSubmit={changePassword} />
    </section>
  )

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-end gap-3 text-sm text-slate-600">
        <span>{session.user.email}</span>
        <button type="button" onClick={() => { setShowPasswordChange((value) => !value); setAuthError(''); setAuthMessage('') }} className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 font-bold"><KeyRound className="h-4 w-4" />パスワード変更</button>
        <button type="button" onClick={() => void supabase.auth.signOut()} className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 font-bold"><LogOut className="h-4 w-4" />ログアウト</button>
      </div>
      {showPasswordChange ? <section className="no-print panel ml-auto max-w-md rounded-none p-5"><h2 className="text-lg font-black">パスワード変更</h2><PasswordChangeForm loading={loading} error={authError} newPassword={newPassword} confirm={newPasswordConfirm} onPassword={setNewPassword} onConfirm={setNewPasswordConfirm} onSubmit={changePassword} /></section> : null}
      {authMessage ? <p className="no-print bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{authMessage}</p> : null}
      <nav className="no-print panel grid rounded-none p-2 sm:grid-cols-4" aria-label="管理メニュー">
        {([
          ['daily', '日報入力・設置状況'],
          ['container-ledger', 'コンテナ管理表'],
          ['collection-history', '収集履歴'],
          ['masters', '排出事業者・現場登録'],
        ] as const).map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-4 text-sm font-black transition ${activeTab === tab ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 hover:bg-emerald-50'}`}>
            {label}
          </button>
        ))}
      </nav>

      {!masterReady ? <p className="no-print border-l-8 border-amber-600 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">顧客番号・現場番号・カゴ台数管理を有効にするデータベース更新がまだ適用されていません。既存のコンテナ閲覧はできますが、新機能の登録は更新後にご利用ください。</p> : null}

      {activeTab === 'daily' ? <>
      <section className="grid gap-4 md:grid-cols-3">
        {stored.thresholds.map((threshold) => (
          <div key={threshold.id} className="panel rounded-none p-5">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-bold text-rose-700">長期設置コンテナ</p><p className="mt-2 text-4xl font-black">{longTerm.filter((item) => item.elapsedDays >= threshold.days).length}件</p></div>
              <AlertTriangle className="h-8 w-8 text-rose-700" />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">{threshold.label}</p>
          </div>
        ))}
      </section>

      <form className="panel rounded-none p-5" onSubmit={submit}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3"><Truck className="h-8 w-8 text-emerald-800" /><h2 className="text-xl font-black">作業日報入力</h2></div>
            <p className="mt-2 text-sm text-slate-600">紙の日報と同じ順番で、1日分をまとめて入力します。</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:w-[560px]">
            <label className="space-y-2 text-sm font-bold text-slate-700">日付
              <input type="date" className="w-full border border-slate-300 px-4 py-3" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
            </label>
            <label className="space-y-2 text-sm font-bold text-slate-700">名前（ドライバー）
              <input className="w-full border border-slate-300 px-4 py-3" placeholder="例：しのみや" value={driverName} onChange={(event) => setDriverName(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[1320px] border-collapse text-sm">
            <thead className="bg-slate-100"><tr>
              {['No.', '種類', '排出事業者名', '現場名', '設置', '引上げ', '受託数量・備考（設置のみ任意）', '自動判定', ''].map((title) => <th key={title} className="border border-slate-300 px-3 py-3 text-left">{title}</th>)}
            </tr></thead>
            <tbody>{rows.map((row, index) => {
              const type = workType(row)
              const selectedCustomer = customers.find((customer) => customer.id === row.customerId)
              const selectedSite = sites.find((site) => site.id === row.siteId)
              const availableSites = sites.filter((site) => site.customerId === row.customerId)
              return <tr key={row.id} className="bg-white align-top">
                <td className="border border-slate-300 px-3 py-4 text-center font-black">{index + 1}</td>
                <td className="border border-slate-300 p-2"><select className="min-w-32 border border-slate-200 bg-white px-3 py-3" value={row.entryType} onChange={(event) => updateRow(row.id, event.target.value === 'basket'
                  ? { entryType: 'basket', installAssetId: '', collectAssetId: '' }
                  : { entryType: 'container', basketInstallCount: '', basketCollectCount: '' })}><option value="container">コンテナ</option><option value="basket">台数管理</option></select>
                  {row.entryType === 'basket' ? <><input className="mt-2 min-w-32 border border-slate-200 px-3 py-3" list={`basket-type-options-${row.id}`} placeholder="種類を入力" value={row.basketType} onChange={(event) => updateRow(row.id, { basketType: event.target.value })} /><datalist id={`basket-type-options-${row.id}`}>{['カゴ', '1.5カゴ', 'IBCコンテナ', 'ネット', 'ネット(8㎥)', '黒ネット', 'シート', 'シート(8㎥)', 'ブルーシート', 'キーパー', '岩本コンテナ', '山畑コンテナ（4㎥）', '宇賀神カゴ', 'GOKO(4㎥)'].map((item) => <option key={item} value={item} />)}</datalist></> : null}</td>
                <td className="border border-slate-300 p-2">
                  <input className="w-full min-w-56 border border-slate-200 px-3 py-3" list={`customer-options-${row.id}`} placeholder="番号・名称・カナで検索" value={selectedCustomer ? customerOption(selectedCustomer) : row.companyName} onChange={(event) => updateCustomer(row.id, event.target.value)} />
                  <datalist id={`customer-options-${row.id}`}>{customers.map((customer) => <option key={customer.id} value={customerOption(customer)} />)}</datalist>
                </td>
                <td className="border border-slate-300 p-2">
                  <input className="w-full min-w-56 border border-slate-200 px-3 py-3" list={`site-options-${row.id}`} placeholder={row.customerId ? '番号・名称・カナで検索' : '先に排出事業者を選択'} value={selectedSite ? siteOption(selectedSite) : row.siteName} onChange={(event) => updateSite(row.id, row.customerId, event.target.value)} />
                  <datalist id={`site-options-${row.id}`}>{availableSites.map((site) => <option key={site.id} value={siteOption(site)} />)}</datalist>
                </td>
                <td className="border border-slate-300 p-2">{row.entryType === 'basket'
                  ? <input type="number" min="0" step="1" inputMode="numeric" className="w-full min-w-24 border border-slate-200 px-3 py-3" placeholder="台数" value={row.basketInstallCount} onChange={(event) => updateRow(row.id, { basketInstallCount: event.target.value })} />
                  : <input autoCapitalize="characters" className="w-full min-w-28 border border-slate-200 px-3 py-3" placeholder="408 / CS002" value={assetIdentifier(row.installAssetId)} onChange={(event) => updateRow(row.id, { installAssetId: normalizeAssetIdentifier(event.target.value) })} />}</td>
                <td className="border border-slate-300 p-2">{row.entryType === 'basket'
                  ? <input type="number" min="0" step="1" inputMode="numeric" className="w-full min-w-24 border border-slate-200 px-3 py-3" placeholder="台数" value={row.basketCollectCount} onChange={(event) => updateRow(row.id, { basketCollectCount: event.target.value })} />
                  : <input autoCapitalize="characters" className="w-full min-w-28 border border-slate-200 px-3 py-3" placeholder="210 / M003" value={assetIdentifier(row.collectAssetId)} onChange={(event) => updateRow(row.id, { collectAssetId: normalizeAssetIdentifier(event.target.value) })} />}</td>
                <td className="border border-slate-300 p-2"><textarea className="min-h-12 w-full min-w-52 border border-slate-200 px-3 py-3" placeholder="例：金属くず 310kg（自動車部品）" value={row.quantityNote} onChange={(event) => updateRow(row.id, { quantityNote: event.target.value })} /></td>
                <td className="border border-slate-300 px-2 py-4 text-center"><span className={`inline-flex px-3 py-1 text-xs font-black ${typeColor(type)}`}>{type}</span></td>
                <td className="border border-slate-300 p-2"><button type="button" className="p-3 text-slate-400 hover:text-rose-700" onClick={() => setRows((current) => current.length === 1 ? [emptyRow()] : current.filter((item) => item.id !== row.id))} aria-label="行を削除"><Trash2 className="h-5 w-5" /></button></td>
              </tr>
            })}</tbody>
          </table>
        </div>
        <button type="button" className="mt-3 inline-flex items-center gap-2 border border-emerald-700 px-4 py-3 text-sm font-black text-emerald-800" onClick={() => setRows((current) => [...current, emptyRow()])}><Plus className="h-5 w-5" />行を追加する</button>
        {errors.length ? <div className="mt-5 border-l-8 border-rose-700 bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-900">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        {message ? <p className="mt-5 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{message}</p> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <button type="submit" disabled={loading} className="bg-emerald-700 px-4 py-4 text-base font-black text-white disabled:opacity-60">{loading ? '保存中…' : 'この日報を登録して管理表へ反映'}</button>
          <button type="button" className="inline-flex items-center justify-center gap-2 border border-slate-300 px-4 py-4 text-sm font-black" onClick={reset}><RotateCcw className="h-5 w-5" />入力をクリア</button>
        </div>
      </form>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel rounded-none p-5">
          <div className="flex items-start justify-between"><div><h2 className="text-xl font-black">今どこに何があるか</h2><p className="mt-2 text-sm text-slate-600">排出事業者名またはコンテナ番号で検索できます。</p></div><PackageCheck className="h-8 w-8 text-emerald-800" /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-bold">排出事業者名で検索<div className="mt-2 flex border border-slate-200 px-3"><Search className="my-auto h-5 w-5 text-slate-500" /><input className="w-full px-3 py-3 outline-none" value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} /></div></label>
            <label className="text-sm font-bold">コンテナ番号で検索<div className="mt-2 flex border border-slate-200 px-3"><Search className="my-auto h-5 w-5 text-slate-500" /><input className="w-full px-3 py-3 outline-none" value={containerQuery} onChange={(event) => setContainerQuery(event.target.value)} /></div></label>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {searchResults.map((item) => { const elapsedDays = daysFrom(item.installedOn); return <article key={item.id} className="border-l-8 border-emerald-700 bg-emerald-50 p-5"><p className="font-bold text-emerald-900">{item.companyName}</p><h3 className="mt-2 text-3xl font-black">{item.assetLabel}</h3><div className="mt-4 space-y-2 text-sm font-bold text-slate-700"><p>設置日：{formatDate(item.installedOn)}</p><p>経過日数：{elapsedDays === null ? '計算対象外' : `${elapsedDays}日`}</p><p>種類：{item.sizeLabel} {item.assetType}</p><p>現場名：{item.siteName}</p></div></article> })}
            {basketSearchResults.map((item) => <article key={item.id} className="border-l-8 border-sky-700 bg-sky-50 p-5"><p className="font-bold text-sky-900">{item.companyName}</p><h3 className="mt-2 text-3xl font-black">{item.basketType} {item.quantity}台</h3><div className="mt-4 space-y-2 text-sm font-bold text-slate-700"><p>種類：{item.basketType}</p><p>現場名：{item.siteName}</p></div></article>)}
          </div>
        </section>
        <section className="panel rounded-none p-5"><h2 className="text-xl font-black">設置期間が長い順</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-100"><tr>{['経過', '番号', '排出事業者名', '現場名', '設置日'].map((title) => <th key={title} className="border border-slate-200 px-3 py-3 text-left">{title}</th>)}</tr></thead><tbody>{longTerm.slice(0, 12).map((item) => <tr key={item.id}><td className="border border-slate-200 px-3 py-3 font-black text-rose-700">{item.elapsedDays}日</td><td className="border border-slate-200 px-3 py-3 font-bold">{item.assetLabel}</td><td className="border border-slate-200 px-3 py-3">{item.companyName}</td><td className="border border-slate-200 px-3 py-3">{item.siteName}</td><td className="border border-slate-200 px-3 py-3">{formatDate(item.installedOn)}</td></tr>)}</tbody></table></div></section>
      </section>

      </> : null}

      {activeTab === 'masters' ? <section className="space-y-6">
        <div className="panel rounded-none p-5">
          <div className="flex items-start gap-3"><Database className="h-8 w-8 text-emerald-800" /><div><h2 className="text-xl font-black">排出事業者・現場登録</h2><p className="mt-2 text-sm leading-6 text-slate-600">顧客番号と現場番号で紐づけます。名称またはカナの一部を入力すると、日報入力時に候補を検索できます。</p></div></div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="panel rounded-none p-5" onSubmit={addCustomer}>
            <h3 className="text-lg font-black">排出事業者を登録</h3>
            <div className="mt-4 grid gap-4">
              <label className="text-sm font-bold">顧客番号<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：C0001" value={customerCode} onChange={(event) => setCustomerCode(event.target.value)} /></label>
              <label className="text-sm font-bold">排出事業者名<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：大橋技建株式会社" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></label>
              <label className="text-sm font-bold">カナ<input className="mt-2 w-full border border-slate-300 px-4 py-3" placeholder="例：オオハシギケン" value={customerKana} onChange={(event) => setCustomerKana(event.target.value)} /></label>
            </div>
            <button type="submit" disabled={loading || !masterReady} className="mt-5 w-full bg-emerald-800 px-4 py-3 font-black text-white disabled:opacity-50">排出事業者を登録</button>
          </form>
          <form className="panel rounded-none p-5" onSubmit={addSite}>
            <h3 className="text-lg font-black">現場を登録</h3>
            <div className="mt-4 grid gap-4">
              <label className="text-sm font-bold">排出事業者<select className="mt-2 w-full border border-slate-300 bg-white px-4 py-3" required value={siteCustomerId} onChange={(event) => setSiteCustomerId(event.target.value)}><option value="">選択してください</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customerCode}｜{customer.name}</option>)}</select></label>
              <label className="text-sm font-bold">現場番号<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：S001" value={siteCode} onChange={(event) => setSiteCode(event.target.value)} /></label>
              <label className="text-sm font-bold">現場名<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：本社工場" value={siteName} onChange={(event) => setSiteName(event.target.value)} /></label>
              <label className="text-sm font-bold">カナ<input className="mt-2 w-full border border-slate-300 px-4 py-3" placeholder="例：ホンシャコウジョウ" value={siteKana} onChange={(event) => setSiteKana(event.target.value)} /></label>
            </div>
            <button type="submit" disabled={loading || !masterReady} className="mt-5 w-full bg-emerald-800 px-4 py-3 font-black text-white disabled:opacity-50">現場を登録</button>
          </form>
        </div>
        {errors.length ? <div className="border-l-8 border-rose-700 bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-900">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        {masterMessage ? <p className="bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{masterMessage}</p> : null}
        <section className="panel rounded-none p-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-black">登録済み一覧</h3><p className="mt-2 text-sm text-slate-600">排出事業者 {customers.length}件／現場 {sites.length}件</p></div></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100"><tr>{['顧客番号', '排出事業者名', 'カナ', '登録済み現場'].map((title) => <th key={title} className="border border-slate-200 px-3 py-3 text-left">{title}</th>)}</tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td className="border border-slate-200 px-3 py-3 font-bold">{customer.customerCode}</td><td className="border border-slate-200 px-3 py-3">{customer.name}</td><td className="border border-slate-200 px-3 py-3">{customer.nameKana}</td><td className="border border-slate-200 px-3 py-3">{sites.filter((site) => site.customerId === customer.id).map((site) => `${site.siteCode} ${site.name}`).join('、') || '未登録'}</td></tr>)}</tbody></table></div>
        </section>
      </section> : null}

      {activeTab === 'container-ledger' ? <section className="space-y-5">
        <div className="no-print panel rounded-none p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <label className="block text-sm font-bold text-slate-700">コンテナ番号
              <input className="mt-2 block min-w-72 border border-slate-300 bg-white px-4 py-3" list="container-ledger-options" placeholder="番号を入力して検索" value={ledgerAssetQuery} onChange={(event) => selectLedgerAsset(event.target.value)} />
              <datalist id="container-ledger-options">{assetOptions.map((item) => <option key={item.id} value={item.label}>{item.sizeLabel}・{item.assetType}</option>)}</datalist>
            </label>
            <button type="button" className="inline-flex items-center justify-center gap-2 bg-emerald-800 px-5 py-3 font-black text-white" onClick={() => printSheet('container-ledger')}><Printer className="h-5 w-5" />A4 PDF・印刷</button>
          </div>
        </div>
        {sheetLoading ? <p className="no-print text-sm font-bold text-emerald-800">帳票データを読み込み中です…</p> : null}
        <div className={`paper-sheet paper-portrait ${printTarget === 'container-ledger' ? 'print-target' : ''}`}>
          <div className="paper-title-row"><p>No. <span>{selectedAsset?.label.replace('番', '')}</span></p><h2>コンテナ管理表</h2></div>
          <table className="paper-table container-ledger-table">
            <thead><tr><th>設置年月日</th><th>回収年月日</th><th>排出事業者名</th><th>現場名</th></tr></thead>
            <tbody>{Array.from({ length: Math.max(24, ledgerRows.length) }, (_, index) => {
              const report = ledgerRows[index]
              return <tr key={report?.id ?? `empty-${index}`}><td>{report?.installAssetId === ledgerAssetId ? formatDate(report.workDate) : ''}</td><td>{report?.collectAssetId === ledgerAssetId ? formatDate(report.workDate) : ''}</td><td>{report?.companyName ?? ''}</td><td>{report?.siteName ?? ''}</td></tr>
            })}</tbody>
          </table>
        </div>
      </section> : null}

      {activeTab === 'collection-history' ? <section className="space-y-5">
        <div className="no-print panel rounded-none p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <label className="block text-sm font-bold text-slate-700">排出事業者名
              <input className="mt-2 block w-full border border-slate-300 bg-white px-4 py-3" list="history-company-options" placeholder="事業者名を入力して検索" value={historyCompany} onChange={(event) => { const value = event.target.value; setHistoryCompany(value); setHistoryRows([]); if (!value.trim()) setCompanyOptions([]) }} />
              <datalist id="history-company-options">{companyOptions.map((company) => <option key={company} value={company} />)}</datalist>
            </label>
            <label className="block text-sm font-bold text-slate-700">管理年
              <select className="mt-2 block w-full border border-slate-300 bg-white px-4 py-3" value={historyYear} onChange={(event) => { setHistoryYear(event.target.value); setHistoryRows([]) }}>{years.map((year) => <option key={year} value={year}>{year}年</option>)}</select>
            </label>
            <button type="button" className="inline-flex items-center justify-center gap-2 bg-emerald-800 px-5 py-3 font-black text-white" onClick={() => printSheet('collection-history')}><Printer className="h-5 w-5" />A4 PDF・印刷</button>
          </div>
          <p className="mt-3 text-sm text-slate-600">排出事業者名と年を選ぶと、1年分の収集履歴を紙と同じ形式で保存できます。</p>
        </div>
        {sheetLoading ? <p className="no-print text-sm font-bold text-emerald-800">帳票データを読み込み中です…</p> : null}
        <div className={`paper-sheet paper-landscape ${printTarget === 'collection-history' ? 'print-target' : ''}`}>
          <div className="collection-heading"><div><span>排出事業者名</span><strong>{historyCompany}</strong></div><h2>収集履歴</h2><p>{historyYear}年</p></div>
          <table className="paper-table collection-table">
            <colgroup><col style={{ width: '13%' }} /><col style={{ width: '23%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '36%' }} /></colgroup>
            <thead><tr><th rowSpan={2}>収集年月日</th><th rowSpan={2}>現場名（工事件名）及び住所</th><th rowSpan={2}>運搬者</th><th colSpan={2}>コンテナ番号</th><th rowSpan={2}>品目・数量及び処分先・備考</th></tr><tr><th>設置</th><th>回収</th></tr></thead>
            <tbody>{Array.from({ length: Math.max(18, historyRows.length) }, (_, index) => {
              const report = historyRows[index]
              const installLabel = report?.assetType === 'カゴ' && report.basketInstallCount
                ? `${report.sizeLabel || 'カゴ'}×${report.basketInstallCount}`
                : report?.installAssetLabel?.replace('番', '') ?? ''
              const collectLabel = report?.assetType === 'カゴ' && report.basketCollectCount
                ? `${report.sizeLabel || 'カゴ'}×${report.basketCollectCount}`
                : report?.collectAssetLabel?.replace('番', '') ?? ''
              return <tr key={report?.id ?? `empty-${index}`}><td>{report ? formatDate(report.workDate) : ''}</td><td>{report?.siteName ?? ''}</td><td>{report?.driverName ?? ''}</td><td>{installLabel}</td><td>{collectLabel}</td><td>{report?.quantity ?? ''}{report?.note && report.note !== report.quantity ? ` ${report.note}` : ''}</td></tr>
            })}</tbody>
          </table>
        </div>
      </section> : null}
    </div>
  )
}
