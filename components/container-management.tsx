'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Database, KeyRound, LogOut, PackageCheck, PencilLine, Plus, Printer, RotateCcw, Search, Trash2, Truck, X } from 'lucide-react'
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
  type DriverMaster,
  type QuantityAssetType,
  type QuantityItemMaster,
  type SiteMaster,
} from '@/lib/container-data'
import { buildQuantityLedgerRows, type LedgerLifecycleRow } from '@/lib/container-ledger'

type ReportRow = {
  id: string
  entryType: 'container' | 'basket' | 'equipment'
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

type CorrectionDraft = ReportRow & {
  reportId: string
  workDate: string
  driverName: string
}

type AppTab = 'daily' | 'container-ledger' | 'collection-history' | 'masters' | 'corrections'
type PrintTarget = 'container-ledger' | 'collection-history' | null

type LedgerOption = {
  id: string
  label: string
  kind: 'container' | 'quantity'
  category?: QuantityAssetType
  itemType?: string
  sizeLabel?: string
}

type CustomerEditDraft = Pick<CustomerMaster, 'id' | 'customerCode' | 'name' | 'nameKana' | 'previousName'>
type SiteEditDraft = Pick<SiteMaster, 'id' | 'siteCode' | 'name' | 'nameKana'>
type ItemTypeEditDraft = Pick<QuantityItemMaster, 'id' | 'category' | 'name'>

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

function compareCodes(a: string, b: string) {
  return a.localeCompare(b, 'ja', { numeric: true, sensitivity: 'base' })
}

function isQuantityEntry(row: ReportRow) {
  return row.entryType === 'basket' || row.entryType === 'equipment'
}

function quantityCategory(row: ReportRow): QuantityAssetType {
  return row.entryType === 'equipment' ? '貸出備品' : 'カゴ'
}

function isQuantityAssetType(value: ContainerReport['assetType']): value is QuantityAssetType {
  return value === 'カゴ' || value === '貸出備品'
}

function customerDisplayName(customer: CustomerMaster) {
  return customer.previousName
    ? `${customer.name}（旧社名：${customer.previousName}）`
    : customer.name
}

function toKatakana(value: string) {
  return value.normalize('NFKC').replace(/[ぁ-ゖ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) + 0x60),
  )
}

function kanaCandidate(value: string) {
  const normalized = value.normalize('NFKC')
  return /^[ぁ-ゖァ-ヶー\s　]+$/u.test(normalized) ? toKatakana(normalized) : ''
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
  if (isQuantityEntry(row)) {
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
  return [customer.customerCode, customerDisplayName(customer), customer.nameKana].filter(Boolean).join('｜')
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
    quantity: item.quantity == null ? '' : String(item.quantity), note: item.note ? String(item.note) : undefined,
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
  const [historyCustomerId, setHistoryCustomerId] = useState('')
  const [historyYear, setHistoryYear] = useState(String(new Date().getFullYear()))
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null)
  const [companyOptions, setCompanyOptions] = useState<CustomerMaster[]>([])
  const [assetOptions, setAssetOptions] = useState<LedgerOption[]>([])
  const [ledgerRows, setLedgerRows] = useState<LedgerLifecycleRow[]>([])
  const [historyRows, setHistoryRows] = useState<ContainerReport[]>([])
  const [sheetLoading, setSheetLoading] = useState(false)
  const [customers, setCustomers] = useState<CustomerMaster[]>([])
  const [sites, setSites] = useState<SiteMaster[]>([])
  const [basketBalances, setBasketBalances] = useState<BasketBalance[]>([])
  const [drivers, setDrivers] = useState<DriverMaster[]>([])
  const [itemTypes, setItemTypes] = useState<QuantityItemMaster[]>([])
  const [masterReady, setMasterReady] = useState(true)
  const [customerCode, setCustomerCode] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerKana, setCustomerKana] = useState('')
  const [siteCustomerId, setSiteCustomerId] = useState('')
  const [siteCode, setSiteCode] = useState('')
  const [siteName, setSiteName] = useState('')
  const [siteKana, setSiteKana] = useState('')
  const [siteCustomerQuery, setSiteCustomerQuery] = useState('')
  const [driverMasterName, setDriverMasterName] = useState('')
  const [itemCategory, setItemCategory] = useState<QuantityAssetType>('カゴ')
  const [itemTypeName, setItemTypeName] = useState('')
  const [itemTypeEdit, setItemTypeEdit] = useState<ItemTypeEditDraft | null>(null)
  const [masterQuery, setMasterQuery] = useState('')
  const [masterMessage, setMasterMessage] = useState('')
  const [customerSort, setCustomerSort] = useState<'code' | 'kana'>('code')
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(() => new Set())
  const [customerEdit, setCustomerEdit] = useState<CustomerEditDraft | null>(null)
  const [siteEdit, setSiteEdit] = useState<SiteEditDraft | null>(null)
  const [correctionQuery, setCorrectionQuery] = useState('')
  const [correctionDate, setCorrectionDate] = useState('')
  const [correctionRows, setCorrectionRows] = useState<ContainerReport[]>([])
  const [correctionLoading, setCorrectionLoading] = useState(false)
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft | null>(null)
  const [correctionErrors, setCorrectionErrors] = useState<string[]>([])
  const [correctionMessage, setCorrectionMessage] = useState('')
  const customerKanaBeforeComposition = useRef('')
  const siteKanaBeforeComposition = useRef('')

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
    async function loadPages(table: 'container_customers' | 'container_sites' | 'basket_balances' | 'container_drivers' | 'container_item_types', columns: string) {
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
    const [customersResult, sitesResult, basketResult, driversResult, itemTypesResult] = await Promise.all([
      loadPages('container_customers', 'id,customer_code,name,name_kana,previous_name'),
      loadPages('container_sites', 'id,customer_id,site_code,name,name_kana'),
      loadPages('basket_balances', 'id,customer_id,site_id,company_name,site_name,item_category,basket_type,quantity'),
      loadPages('container_drivers', 'id,name'),
      loadPages('container_item_types', 'id,category,name'),
    ])
    const mastersAvailable = !customersResult.error && !sitesResult.error && !basketResult.error && !driversResult.error && !itemTypesResult.error
    setMasterReady(mastersAvailable)
    if (mastersAvailable) {
      setCustomers(customersResult.data.map((item) => ({ id: String(item.id), customerCode: String(item.customer_code), name: String(item.name), nameKana: String(item.name_kana), previousName: String(item.previous_name ?? '') })))
      setSites(sitesResult.data.map((item) => ({ id: String(item.id), customerId: String(item.customer_id), siteCode: String(item.site_code), name: String(item.name), nameKana: String(item.name_kana) })))
      setBasketBalances(basketResult.data.map((item) => ({ id: String(item.id), customerId: String(item.customer_id), siteId: String(item.site_id), companyName: String(item.company_name), siteName: String(item.site_name), itemCategory: item.item_category as QuantityAssetType, basketType: String(item.basket_type), quantity: Number(item.quantity) })))
      setDrivers(driversResult.data.map((item) => ({ id: String(item.id), name: String(item.name) })).filter((item) => item.name !== '初期登録').sort((a, b) => a.name.localeCompare(b.name, 'ja')))
      setItemTypes(itemTypesResult.data.map((item) => ({ id: String(item.id), category: item.category as QuantityAssetType, name: String(item.name) })).sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true })))
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
  const customersByCode = useMemo(() => [...customers].sort((a, b) => compareCodes(a.customerCode, b.customerCode)), [customers])
  const sitesByCode = useMemo(() => [...sites].sort((a, b) => compareCodes(a.siteCode, b.siteCode)), [sites])
  const selectedLedgerOption = useMemo(() => {
    const loaded = assetOptions.find((item) => item.id === ledgerAssetId)
    if (loaded) return loaded
    if (ledgerAssetId.startsWith('container-')) {
      const selected = asset(ledgerAssetId)
      return selected ? { id: selected.id, label: selected.label, kind: 'container' as const, sizeLabel: selected.sizeLabel } : undefined
    }
    return undefined
  }, [assetOptions, ledgerAssetId])
  const sortedCustomers = useMemo(() => [...customers].sort((a, b) => {
    if (customerSort === 'kana') {
      const aKana = a.nameKana.trim()
      const bKana = b.nameKana.trim()
      if (!aKana && bKana) return 1
      if (aKana && !bKana) return -1
      const kanaOrder = aKana.localeCompare(bKana, 'ja')
      if (kanaOrder !== 0) return kanaOrder
    }
    return a.customerCode.localeCompare(b.customerCode, 'ja', { numeric: true })
  }), [customerSort, customers])
  const filteredCustomers = useMemo(() => {
    const query = normalize(masterQuery)
    if (!query) return sortedCustomers
    return sortedCustomers.filter((customer) => {
      const customerSites = sites.filter((site) => site.customerId === customer.id)
      return [
        customer.customerCode,
        customer.name,
        customer.nameKana,
        ...customerSites.flatMap((site) => [site.siteCode, site.name, site.nameKana]),
      ].some((value) => normalize(value).includes(query))
    })
  }, [masterQuery, sites, sortedCustomers])
  const correctionCustomer = correctionDraft ? customers.find((customer) => customer.id === correctionDraft.customerId) : undefined
  const correctionSite = correctionDraft ? sites.find((site) => site.id === correctionDraft.siteId) : undefined
  const correctionSiteOptions = correctionDraft ? sitesByCode.filter((site) => site.customerId === correctionDraft.customerId) : []
  const historyHeadingCompany = historyRows.at(-1)?.companyName ?? historyCompany

  const quantityLedgerOptions = useMemo<LedgerOption[]>(() => itemTypes.map((item) => ({
    id: `quantity:${item.category}:${item.name}`,
    label: `${item.name}（${item.category}）`,
    kind: 'quantity',
    category: item.category,
    itemType: item.name,
  })), [itemTypes])

  useEffect(() => {
    if (!session || !ledgerAssetQuery.trim()) return
    const timer = window.setTimeout(async () => {
      const identifier = normalizeAssetIdentifier(ledgerAssetQuery)
      const result = await supabase.from('container_assets').select('id,label,asset_type,size_label')
        .ilike('label', `%${identifier}%`).limit(30)
      if (!result.error) {
        const containers: LedgerOption[] = (result.data ?? []).map((item) => ({ id: item.id, label: item.label, kind: 'container' as const, sizeLabel: item.size_label }))
          .sort((a, b) => compareCodes(a.label, b.label))
        const query = normalize(ledgerAssetQuery)
        const quantity = quantityLedgerOptions.filter((item) => normalize(item.label).includes(query))
        setAssetOptions([...containers, ...quantity])
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [ledgerAssetQuery, quantityLedgerOptions, session])

  useEffect(() => {
    if (!session || historyCompany.trim().length < 1) return
    if (masterReady && customers.length) {
      const query = normalize(historyCompany)
      const timer = window.setTimeout(() => {
        setCompanyOptions(customersByCode.filter((customer) =>
          [customer.customerCode, customer.name, customer.nameKana, customer.previousName].some((value) => normalize(value).includes(query)),
        ).slice(0, 30))
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(async () => {
      const result = await supabase.from('container_reports').select('company_name')
        .ilike('company_name', `%${historyCompany.trim()}%`).limit(200)
      if (!result.error) setCompanyOptions(Array.from(new Set((result.data ?? []).map((item) => item.company_name))).slice(0, 30).map((name, index) => ({ id: `legacy-${index}`, customerCode: '', name, nameKana: '', previousName: '' })))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [customers.length, customersByCode, historyCompany, masterReady, session])

  useEffect(() => {
    if (!session || !ledgerAssetId) return
    let cancelled = false
    void (async () => {
      setSheetLoading(true)
      const option = assetOptions.find((item) => item.id === ledgerAssetId)
      if (option?.kind === 'quantity' && option.category && option.itemType) {
        const reports: ContainerReport[] = []
        for (let from = 0; ; from += PAGE_SIZE) {
          const result = await supabase.from('container_reports').select('*')
            .eq('asset_type', option.category).eq('size_label', option.itemType)
            .order('work_date', { ascending: true }).order('entry_order', { ascending: true })
            .range(from, from + PAGE_SIZE - 1)
          if (result.error || cancelled) break
          reports.push(...(result.data ?? []).map(reportFromRow))
          if ((result.data?.length ?? 0) < PAGE_SIZE) break
        }
        if (!cancelled) setLedgerRows(buildQuantityLedgerRows(reports))
      } else {
        const assignments: LedgerLifecycleRow[] = []
        for (let from = 0; ; from += PAGE_SIZE) {
          const result = await supabase.from('container_assignments')
            .select('id,installed_on,collected_on,company_name,site_name')
            .eq('asset_id', ledgerAssetId).order('installed_on', { ascending: true, nullsFirst: true })
            .range(from, from + PAGE_SIZE - 1)
          if (result.error || cancelled) break
          assignments.push(...(result.data ?? []).map((item) => ({
            id: String(item.id), installedOn: item.installed_on ? String(item.installed_on) : null,
            collectedOn: item.collected_on ? String(item.collected_on) : null,
            companyName: String(item.company_name), siteName: String(item.site_name), quantity: 1,
          })))
          if ((result.data?.length ?? 0) < PAGE_SIZE) break
        }
        if (!cancelled) setLedgerRows(assignments)
      }
      if (!cancelled) setSheetLoading(false)
    })()
    return () => { cancelled = true }
  }, [assetOptions, ledgerAssetId, session])

  useEffect(() => {
    if (!session || (!historyCompany.trim() && !historyCustomerId) || !historyYear) return
    let cancelled = false
    void (async () => {
      setSheetLoading(true)
      const reports: ContainerReport[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        let query = supabase.from('container_reports').select('*')
          .gte('work_date', `${historyYear}-01-01`).lte('work_date', `${historyYear}-12-31`)
        query = historyCustomerId ? query.eq('customer_id', historyCustomerId) : query.eq('company_name', historyCompany.trim())
        const result = await query
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
  }, [historyCompany, historyCustomerId, historyYear, session])

  function printSheet(target: Exclude<PrintTarget, null>) {
    document.getElementById('print-page-orientation')?.remove()
    const pageStyle = document.createElement('style')
    pageStyle.id = 'print-page-orientation'
    pageStyle.textContent = '@media print { @page { size: A4 portrait; margin: 0; } }'
    document.head.appendChild(pageStyle)

    setPrintTarget(target)
    const cleanup = () => {
      pageStyle.remove()
      setPrintTarget(null)
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(() => {
      window.print()
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
    const exact = assetOptions.find((item) => item.label === value)
    if (exact) setLedgerAssetId(exact.id)
    else {
      const identifier = normalizeAssetIdentifier(value)
      setLedgerAssetId(identifier ? `container-${identifier.toLowerCase()}` : '')
    }
  }

  function selectHistoryCustomer(value: string) {
    setHistoryCompany(value)
    setHistoryRows([])
    if (!value.trim()) {
      setHistoryCustomerId('')
      setCompanyOptions([])
      return
    }
    const exact = customers.find((customer) =>
      value === customerOption(customer)
      || value === customer.customerCode
      || value === customer.name
      || value === customer.nameKana
      || value === customerDisplayName(customer),
    )
    setHistoryCustomerId(exact?.id ?? '')
    if (exact) setHistoryCompany(customerDisplayName(exact))
  }

  function updateRow(id: string, patch: Partial<ReportRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function changeEntryType(rowId: string, entryType: ReportRow['entryType']) {
    if (entryType === 'container') {
      updateRow(rowId, { entryType, basketInstallCount: '', basketCollectCount: '' })
      return
    }
    const category: QuantityAssetType = entryType === 'equipment' ? '貸出備品' : 'カゴ'
    const defaultType = itemTypes.find((item) => item.category === category)?.name ?? (entryType === 'equipment' ? 'シート' : 'カゴ')
    updateRow(rowId, { entryType, basketType: defaultType, installAssetId: '', collectAssetId: '' })
  }

  function updateCustomer(rowId: string, value: string) {
    const exact = customers.find((customer) => value === customerOption(customer) || value === customer.name || value === customer.customerCode || value === customer.nameKana || value === customerDisplayName(customer))
    updateRow(rowId, exact
      ? { customerId: exact.id, companyName: customerDisplayName(exact), siteId: '', siteName: '' }
      : { customerId: '', companyName: value, siteId: '', siteName: '' })
  }

  function updateSite(rowId: string, customerId: string, value: string) {
    const exact = sites.find((site) => site.customerId === customerId && (value === siteOption(site) || value === site.name || value === site.siteCode || value === site.nameKana))
    updateRow(rowId, exact ? { siteId: exact.id, siteName: exact.name } : { siteId: '', siteName: value })
  }

  function selectSiteCustomer(value: string) {
    setSiteCustomerQuery(value)
    const exact = customers.find((customer) =>
      value === customerOption(customer)
      || value === customer.customerCode
      || value === customer.name
      || value === customer.nameKana,
    )
    setSiteCustomerId(exact?.id ?? '')
    if (exact) setSiteCustomerQuery(customerOption(exact))
  }

  function updateCorrection(patch: Partial<CorrectionDraft>) {
    setCorrectionDraft((current) => current ? { ...current, ...patch } : current)
  }

  function updateCorrectionCustomer(value: string) {
    const exact = customers.find((customer) =>
      value === customerOption(customer)
      || value === customer.customerCode
      || value === customer.name
      || value === customer.nameKana,
    )
    updateCorrection(exact
      ? { customerId: exact.id, companyName: customerDisplayName(exact), siteId: '', siteName: '' }
      : { customerId: '', companyName: value, siteId: '', siteName: '' })
  }

  function updateCorrectionSite(customerId: string, value: string) {
    const exact = sites.find((site) => site.customerId === customerId
      && (value === siteOption(site) || value === site.siteCode || value === site.name || value === site.nameKana))
    updateCorrection(exact ? { siteId: exact.id, siteName: exact.name } : { siteId: '', siteName: value })
  }

  async function loadCorrectionReports() {
    setCorrectionLoading(true)
    setCorrectionErrors([])
    setCorrectionMessage('')
    setCorrectionDraft(null)

    let query = supabase.from('container_reports').select('*').not('id', 'like', 'initial-report-%')
    if (correctionDate) query = query.eq('work_date', correctionDate)
    const search = correctionQuery.trim().replace(/[,()%]/g, ' ')
    if (search) {
      query = query.or([
        `company_name.ilike.%${search}%`,
        `site_name.ilike.%${search}%`,
        `driver_name.ilike.%${search}%`,
        `install_asset_label.ilike.%${search}%`,
        `collect_asset_label.ilike.%${search}%`,
        `quantity.ilike.%${search}%`,
      ].join(','))
    }
    const result = await query.order('work_date', { ascending: false }).order('created_at', { ascending: false }).limit(100)
    if (result.error) {
      setCorrectionErrors([`入力履歴を読み込めませんでした：${result.error.message}`])
      setCorrectionRows([])
    } else {
      setCorrectionRows((result.data ?? []).map(reportFromRow))
      setCorrectionMessage((result.data?.length ?? 0) === 100
        ? '最新100件を表示しています。対象が見つからない場合は、日付または検索語で絞り込んでください。'
        : `${result.data?.length ?? 0}件見つかりました。`)
    }
    setCorrectionLoading(false)
  }

  function startCorrection(report: ContainerReport) {
    setCorrectionErrors([])
    setCorrectionMessage('')
    setCorrectionDraft({
      id: `correction-${report.id}`,
      reportId: report.id,
      workDate: report.workDate,
      driverName: report.driverName,
      entryType: report.assetType === '貸出備品' ? 'equipment' : report.assetType === 'カゴ' ? 'basket' : 'container',
      basketType: isQuantityAssetType(report.assetType) ? report.sizeLabel || report.assetType : 'カゴ',
      customerId: report.customerId ?? '',
      companyName: report.companyName,
      siteId: report.siteId ?? '',
      siteName: report.siteName,
      installAssetId: assetIdentifier(report.installAssetId ?? ''),
      collectAssetId: assetIdentifier(report.collectAssetId ?? ''),
      basketInstallCount: String(report.basketInstallCount ?? 0),
      basketCollectCount: String(report.basketCollectCount ?? 0),
      quantityNote: report.note ?? report.quantity ?? '',
    })
    window.setTimeout(() => document.getElementById('correction-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function saveCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!correctionDraft) return

    const nextErrors: string[] = []
    const install = !isQuantityEntry(correctionDraft) ? asset(correctionDraft.installAssetId) : undefined
    const collect = !isQuantityEntry(correctionDraft) ? asset(correctionDraft.collectAssetId) : undefined
    const basketInstall = Number(correctionDraft.basketInstallCount || 0)
    const basketCollect = Number(correctionDraft.basketCollectCount || 0)
    if (!correctionDraft.workDate) nextErrors.push('日付を入力してください。')
    if (!correctionDraft.driverName.trim()) nextErrors.push('名前（ドライバー）を入力してください。')
    if (!correctionDraft.customerId) nextErrors.push('登録済みの排出事業者を候補から選択してください。')
    if (!correctionDraft.siteId) nextErrors.push('登録済みの現場を候補から選択してください。')
    if (!isQuantityEntry(correctionDraft)) {
      if (!install && !collect && !correctionDraft.quantityNote.trim()) nextErrors.push('設置・引上げ・受託数量のいずれかを入力してください。')
    } else {
      if (!correctionDraft.basketType.trim()) nextErrors.push('種類を入力してください。')
      if (!Number.isInteger(basketInstall) || !Number.isInteger(basketCollect) || basketInstall < 0 || basketCollect < 0) {
        nextErrors.push('設置・引上げは0以上の整数で入力してください。')
      }
      if (basketInstall === 0 && basketCollect === 0) nextErrors.push('設置または引上げ台数を入力してください。')
    }
    if (workType(correctionDraft) !== '設置' && !correctionDraft.quantityNote.trim()) nextErrors.push('受託数量・備考を入力してください。')
    setCorrectionErrors(nextErrors)
    setCorrectionMessage('')
    if (nextErrors.length) return
    if (!window.confirm('訂正内容を保存すると、現在の設置状況・管理表・収集履歴も再計算されます。保存してよろしいですか？')) return

    setCorrectionLoading(true)
    const result = await supabase.rpc('correct_container_report_v2', {
      p_report_id: correctionDraft.reportId,
      p_work_date: correctionDraft.workDate,
      p_customer_id: correctionDraft.customerId,
      p_site_id: correctionDraft.siteId,
      p_driver_name: correctionDraft.driverName.trim(),
      p_install_asset_id: install?.id ?? null,
      p_install_asset_label: install?.label ?? null,
      p_collect_asset_id: collect?.id ?? null,
      p_collect_asset_label: collect?.label ?? null,
      p_quantity: correctionDraft.quantityNote.trim(),
      p_note: correctionDraft.quantityNote.trim() || null,
      p_quantity_install_count: isQuantityEntry(correctionDraft) ? basketInstall : 0,
      p_quantity_collect_count: isQuantityEntry(correctionDraft) ? basketCollect : 0,
      p_asset_type: isQuantityEntry(correctionDraft) ? quantityCategory(correctionDraft) : 'コンテナ',
      p_size_label: isQuantityEntry(correctionDraft) ? correctionDraft.basketType.trim() : '',
    })
    if (result.error) {
      setCorrectionErrors([`訂正を保存できませんでした：${result.error.message}`])
      setCorrectionLoading(false)
      return
    }

    const response = result.data as { warnings?: string[] } | null
    const warnings = response?.warnings ?? []
    await Promise.all([loadFromSupabase(), loadCorrectionReports()])
    setCorrectionDraft(null)
    setCorrectionMessage(warnings.length
      ? `訂正を保存しました。確認事項：${warnings.join('、')}`
      : '訂正を保存し、現在の設置状況・管理表・収集履歴へ反映しました。')
    setCorrectionLoading(false)
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

      if (isQuantityEntry(row)) {
        const category = quantityCategory(row)
        if (!row.basketType.trim()) next.push(`${line}行目：${category}の種類を入力してください。`)
        if (!Number.isInteger(basketInstall) || !Number.isInteger(basketCollect) || basketInstall < 0 || basketCollect < 0) {
          next.push(`${line}行目：${category}の設置・引上げは0以上の整数で入力してください。`)
        }
        if (basketInstall === 0 && basketCollect === 0) next.push(`${line}行目：${category}の設置または引上げ台数を入力してください。`)
        if (!masterReady || !row.customerId || !row.siteId) next.push(`${line}行目：${category}は登録済みの排出事業者と現場を選択してください。`)
        return
      }

      if (!install && !collect && !row.quantityNote.trim()) next.push(`${line}行目：設置・引上げ・受託数量のいずれかを入力してください。`)

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

    const basketGroups = new Map<string, { row: ReportRow; category: QuantityAssetType; basketType: string; install: number; collect: number; line: number }>()
    inputRows.forEach((row, index) => {
      if (!isQuantityEntry(row) || !row.customerId || !row.siteId) return
      const category = quantityCategory(row)
      const basketType = row.basketType.trim()
      const key = `${row.customerId}:${row.siteId}:${category}:${basketType}`
      const current = basketGroups.get(key)
      basketGroups.set(key, {
        row,
        category,
        basketType,
        install: (current?.install ?? 0) + Number(row.basketInstallCount || 0),
        collect: (current?.collect ?? 0) + Number(row.basketCollectCount || 0),
        line: current?.line ?? index + 1,
      })
    })
    basketGroups.forEach((movement) => {
      const current = basketBalances.find((item) => item.customerId === movement.row.customerId && item.siteId === movement.row.siteId && item.itemCategory === movement.category && item.basketType === movement.basketType)?.quantity ?? 0
      if (current + movement.install - movement.collect < 0) {
        next.push(`${movement.line}行目：${movement.category}の引上げ台数が現在の設置台数（${current}台）を超えています。`)
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
      const install = !isQuantityEntry(row) ? asset(row.installAssetId) : undefined
      const collect = !isQuantityEntry(row) ? asset(row.collectAssetId) : undefined
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
        assetType: isQuantityEntry(row) ? quantityCategory(row) : install?.assetType ?? collect?.assetType ?? '手積み',
        sizeLabel: isQuantityEntry(row) ? row.basketType.trim() : install?.sizeLabel ?? collect?.sizeLabel ?? '手積み',
        quantity: row.quantityNote.trim(),
        note: row.quantityNote.trim() || undefined,
        basketInstallCount: Number(row.basketInstallCount || 0),
        basketCollectCount: Number(row.basketCollectCount || 0),
        entryOrder: index + 1,
      }
    })

    setLoading(true)
    const usedAssets = new Map<string, NonNullable<ReturnType<typeof asset>>>()
    inputRows.filter((row) => !isQuantityEntry(row)).forEach((row) => {
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
      supabase.rpc('apply_quantity_movement', {
        p_customer_id: movement.row.customerId,
        p_site_id: movement.row.siteId,
        p_company_name: movement.row.companyName.trim(),
        p_site_name: movement.row.siteName.trim(),
        p_install_count: movement.install,
        p_collect_count: movement.collect,
        p_item_category: movement.category,
        p_item_type: movement.basketType,
      }),
    ))
    const basketError = basketResults.find((result) => result.error)?.error
    if (basketError) {
      setErrors([`台数管理データを保存できませんでした：${basketError.message}`])
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

  function updateCustomerNameWithKana(value: string) {
    setCustomerName(value)
    const candidate = kanaCandidate(value)
    if (candidate) setCustomerKana(candidate)
    if (!value) setCustomerKana('')
  }

  function updateSiteNameWithKana(value: string) {
    setSiteName(value)
    const candidate = kanaCandidate(value)
    if (candidate) setSiteKana(candidate)
    if (!value) setSiteKana('')
  }

  function updateComposingKana(target: 'customer' | 'site', value: string) {
    const candidate = kanaCandidate(value)
    if (!candidate) return
    if (target === 'customer') setCustomerKana(`${customerKanaBeforeComposition.current}${candidate}`)
    else setSiteKana(`${siteKanaBeforeComposition.current}${candidate}`)
  }

  async function addDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = driverMasterName.trim()
    setErrors([])
    setMasterMessage('')
    if (!name) {
      setErrors(['ドライバー名を入力してください。'])
      return
    }
    setLoading(true)
    const result = await supabase.from('container_drivers').insert({ name })
    if (result.error) {
      setErrors([result.error.code === '23505' ? '同じドライバー名がすでに登録されています。' : `ドライバーを登録できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    setDriverMasterName('')
    await loadFromSupabase()
    setMasterMessage('ドライバーを登録しました。')
  }

  async function addItemType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = itemTypeName.trim()
    setErrors([])
    setMasterMessage('')
    if (!name) {
      setErrors(['種類名を入力してください。'])
      return
    }
    setLoading(true)
    const result = await supabase.from('container_item_types').insert({ category: itemCategory, name })
    if (result.error) {
      setErrors([result.error.code === '23505' ? '同じ種類名がすでに登録されています。' : `種類を登録できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    setItemTypeName('')
    await loadFromSupabase()
    setMasterMessage(`${itemCategory}の種類を登録しました。`)
  }

  async function deleteDriver(driver: DriverMaster) {
    setErrors([])
    setMasterMessage('')
    if (!window.confirm(`ドライバー「${driver.name}」を選択肢から削除します。\n過去の日報に記録された氏名は残ります。削除してよろしいですか？`)) return
    setLoading(true)
    const result = await supabase.from('container_drivers').delete().eq('id', driver.id)
    if (result.error) {
      setErrors([`ドライバーを削除できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    if (driverName === driver.name) setDriverName('')
    await loadFromSupabase()
    setMasterMessage(`ドライバー「${driver.name}」を削除しました。`)
  }

  function startItemTypeEdit(item: QuantityItemMaster) {
    setItemTypeEdit({ id: item.id, category: item.category, name: item.name })
    window.setTimeout(() => document.getElementById('item-type-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  async function saveItemTypeEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!itemTypeEdit) return
    const name = itemTypeEdit.name.trim()
    if (!name) {
      setErrors(['種類名を入力してください。'])
      return
    }
    setErrors([])
    setMasterMessage('')
    setLoading(true)
    const result = await supabase.rpc('rename_container_item_type', {
      p_item_type_id: itemTypeEdit.id,
      p_category: itemTypeEdit.category,
      p_name: name,
    })
    if (result.error) {
      setErrors([`種類を修正できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    setItemTypeEdit(null)
    await loadFromSupabase()
    setMasterMessage(`種類名を「${name}」へ変更しました。既存の台数・履歴・管理表にも反映されています。`)
  }

  async function deleteItemType(item: QuantityItemMaster) {
    setErrors([])
    setMasterMessage('')
    if (!window.confirm(`${item.category}「${item.name}」を削除します。\n使用中または履歴がある種類は削除できません。削除してよろしいですか？`)) return
    setLoading(true)
    const result = await supabase.rpc('delete_container_item_type', { p_item_type_id: item.id })
    if (result.error) {
      setErrors([`種類を削除できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    if (itemTypeEdit?.id === item.id) setItemTypeEdit(null)
    await loadFromSupabase()
    setMasterMessage(`${item.category}「${item.name}」を削除しました。`)
  }

  function startCustomerEdit(customer: CustomerMaster) {
    setCustomerEdit({ id: customer.id, customerCode: customer.customerCode, name: customer.name, nameKana: customer.nameKana, previousName: customer.previousName })
    setSiteEdit(null)
    window.setTimeout(() => document.getElementById('customer-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  function startSiteEdit(site: SiteMaster) {
    setSiteEdit({ id: site.id, siteCode: site.siteCode, name: site.name, nameKana: site.nameKana })
    setCustomerEdit(null)
    window.setTimeout(() => document.getElementById('site-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function saveCustomerEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!customerEdit) return
    setErrors([])
    setMasterMessage('')
    setLoading(true)
    const result = await supabase.rpc('update_container_customer_master', {
      p_customer_id: customerEdit.id,
      p_customer_code: customerEdit.customerCode.trim(),
      p_name: customerEdit.name.trim(),
      p_name_kana: customerEdit.nameKana.trim(),
    })
    if (result.error) {
      setErrors([result.error.code === '23505' ? '同じ顧客番号がすでに登録されています。' : `排出事業者を修正できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    setCustomerEdit(null)
    await loadFromSupabase()
    setMasterMessage('排出事業者を修正しました。名称を変更した場合、今後の入力は「現社名（旧社名：直前の社名）」で保存されます。')
  }

  async function saveSiteEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!siteEdit) return
    setErrors([])
    setMasterMessage('')
    setLoading(true)
    const result = await supabase.rpc('update_container_site_master', {
      p_site_id: siteEdit.id,
      p_site_code: siteEdit.siteCode.trim(),
      p_name: siteEdit.name.trim(),
      p_name_kana: siteEdit.nameKana.trim(),
    })
    if (result.error) {
      setErrors([result.error.code === '23505' ? '同じ現場番号がすでに登録されています。' : `現場を修正できませんでした：${result.error.message}`])
      setLoading(false)
      return
    }
    setSiteEdit(null)
    await loadFromSupabase()
    setMasterMessage('現場を修正しました。今後の入力から新しい現場名を使用します。')
  }

  async function deleteReport(report: ContainerReport) {
    setCorrectionErrors([])
    setCorrectionMessage('')
    const confirmed = window.confirm(
      `${formatDate(report.workDate)}／${report.companyName}／${report.siteName} の入力を削除します。\n\n削除すると元に戻すことはできません。現在の設置状況・管理表・収集履歴も再計算されます。削除してよろしいですか？`,
    )
    if (!confirmed) return
    setCorrectionLoading(true)
    const result = await supabase.rpc('delete_container_report', { p_report_id: report.id })
    if (result.error) {
      setCorrectionErrors([`入力履歴を削除できませんでした：${result.error.message}`])
      setCorrectionLoading(false)
      return
    }
    const response = result.data as { warnings?: string[] } | null
    const warnings = response?.warnings ?? []
    await Promise.all([loadFromSupabase(), loadCorrectionReports()])
    setCorrectionDraft(null)
    setCorrectionMessage(warnings.length
      ? `入力履歴を削除しました。確認事項：${warnings.join('、')}`
      : '入力履歴を削除し、現在の設置状況・管理表・収集履歴を再計算しました。')
    setCorrectionLoading(false)
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
      <nav className="no-print panel grid rounded-none p-2 md:grid-cols-5" aria-label="管理メニュー">
        {([
          ['daily', '日報入力・設置状況'],
          ['container-ledger', 'コンテナ管理表'],
          ['collection-history', '収集履歴'],
          ['masters', '排出事業者・現場登録'],
          ['corrections', '入力履歴・訂正'],
        ] as const).map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => { setActiveTab(tab); if (tab === 'corrections' && !correctionRows.length) void loadCorrectionReports() }} className={`px-4 py-4 text-sm font-black transition ${activeTab === tab ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 hover:bg-emerald-50'}`}>
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
              <select className="w-full border border-slate-300 bg-white px-4 py-3" value={driverName} onChange={(event) => setDriverName(event.target.value)}><option value="">選択してください</option>{drivers.map((driver) => <option key={driver.id} value={driver.name}>{driver.name}</option>)}</select>
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
              const availableSites = sitesByCode.filter((site) => site.customerId === row.customerId)
              const availableItemTypes = itemTypes.filter((item) => item.category === quantityCategory(row))
              return <tr key={row.id} className="bg-white align-top">
                <td className="border border-slate-300 px-3 py-4 text-center font-black">{index + 1}</td>
                <td className="border border-slate-300 p-2"><select className="min-w-36 border border-slate-200 bg-white px-3 py-3" value={row.entryType} onChange={(event) => changeEntryType(row.id, event.target.value as ReportRow['entryType'])}><option value="container">コンテナ</option><option value="basket">カゴ（台数）</option><option value="equipment">貸出備品（台数）</option></select>
                  {isQuantityEntry(row) ? <select className="mt-2 block min-w-36 border border-slate-200 bg-white px-3 py-3" value={row.basketType} onChange={(event) => updateRow(row.id, { basketType: event.target.value })}><option value="">種類を選択</option>{availableItemTypes.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select> : null}</td>
                <td className="border border-slate-300 p-2">
                  <input className="w-full min-w-56 border border-slate-200 px-3 py-3" list={`customer-options-${row.id}`} placeholder="番号・名称・カナで検索" value={selectedCustomer ? customerOption(selectedCustomer) : row.companyName} onChange={(event) => updateCustomer(row.id, event.target.value)} />
                  <datalist id={`customer-options-${row.id}`}>{customersByCode.map((customer) => <option key={customer.id} value={customerOption(customer)} />)}</datalist>
                </td>
                <td className="border border-slate-300 p-2">
                  <input className="w-full min-w-56 border border-slate-200 px-3 py-3" list={`site-options-${row.id}`} placeholder={row.customerId ? '番号・名称・カナで検索' : '先に排出事業者を選択'} value={selectedSite ? siteOption(selectedSite) : row.siteName} onChange={(event) => updateSite(row.id, row.customerId, event.target.value)} />
                  <datalist id={`site-options-${row.id}`}>{availableSites.map((site) => <option key={site.id} value={siteOption(site)} />)}</datalist>
                </td>
                <td className="border border-slate-300 p-2">{isQuantityEntry(row)
                  ? <input type="number" min="0" step="1" inputMode="numeric" className="w-full min-w-24 border border-slate-200 px-3 py-3" placeholder="台数" value={row.basketInstallCount} onChange={(event) => updateRow(row.id, { basketInstallCount: event.target.value })} />
                  : <input autoCapitalize="characters" className="w-full min-w-28 border border-slate-200 px-3 py-3" placeholder="408 / CS002" value={assetIdentifier(row.installAssetId)} onChange={(event) => updateRow(row.id, { installAssetId: normalizeAssetIdentifier(event.target.value) })} />}</td>
                <td className="border border-slate-300 p-2">{isQuantityEntry(row)
                  ? <input type="number" min="0" step="1" inputMode="numeric" className="w-full min-w-24 border border-slate-200 px-3 py-3" placeholder="台数" value={row.basketCollectCount} onChange={(event) => updateRow(row.id, { basketCollectCount: event.target.value })} />
                  : <input autoCapitalize="characters" className="w-full min-w-28 border border-slate-200 px-3 py-3" placeholder="210 / M003" value={assetIdentifier(row.collectAssetId)} onChange={(event) => updateRow(row.id, { collectAssetId: normalizeAssetIdentifier(event.target.value) })} />}</td>
                <td className="border border-slate-300 p-2"><textarea className="min-h-12 w-full min-w-52 whitespace-pre-wrap border border-slate-200 px-3 py-3" placeholder="例：金属くず 310kg（自動車部品）" value={row.quantityNote} onChange={(event) => updateRow(row.id, { quantityNote: event.target.value })} /><p className="mt-1 text-xs text-slate-500">文字数制限なし・改行も帳票へ反映</p></td>
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
              <label className="text-sm font-bold">排出事業者名<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：大橋技建株式会社" value={customerName} onChange={(event) => updateCustomerNameWithKana(event.target.value)} onCompositionStart={() => { customerKanaBeforeComposition.current = customerKana }} onCompositionUpdate={(event) => updateComposingKana('customer', event.data)} /></label>
              <label className="text-sm font-bold">カナ<input className="mt-2 w-full border border-slate-300 px-4 py-3" placeholder="例：オオハシギケン" value={customerKana} onChange={(event) => setCustomerKana(event.target.value)} /></label>
            </div>
            <button type="submit" disabled={loading || !masterReady} className="mt-5 w-full bg-emerald-800 px-4 py-3 font-black text-white disabled:opacity-50">排出事業者を登録</button>
          </form>
          <form className="panel rounded-none p-5" onSubmit={addSite}>
            <h3 className="text-lg font-black">現場を登録</h3>
            <div className="mt-4 grid gap-4">
              <label className="text-sm font-bold">排出事業者
                <input className="mt-2 w-full border border-slate-300 bg-white px-4 py-3" list="site-customer-options" required placeholder="顧客番号・名称・カナで検索" value={siteCustomerQuery} onChange={(event) => selectSiteCustomer(event.target.value)} />
                <datalist id="site-customer-options">{customersByCode.map((customer) => <option key={customer.id} value={customerOption(customer)} />)}</datalist>
              </label>
              <label className="text-sm font-bold">現場番号<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：S001" value={siteCode} onChange={(event) => setSiteCode(event.target.value)} /></label>
              <label className="text-sm font-bold">現場名<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：本社工場" value={siteName} onChange={(event) => updateSiteNameWithKana(event.target.value)} onCompositionStart={() => { siteKanaBeforeComposition.current = siteKana }} onCompositionUpdate={(event) => updateComposingKana('site', event.data)} /></label>
              <label className="text-sm font-bold">カナ<input className="mt-2 w-full border border-slate-300 px-4 py-3" placeholder="例：ホンシャコウジョウ" value={siteKana} onChange={(event) => setSiteKana(event.target.value)} /></label>
            </div>
            <button type="submit" disabled={loading || !masterReady} className="mt-5 w-full bg-emerald-800 px-4 py-3 font-black text-white disabled:opacity-50">現場を登録</button>
          </form>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="panel rounded-none p-5" onSubmit={addDriver}>
            <h3 className="text-lg font-black">ドライバーを登録</h3>
            <p className="mt-2 text-sm text-slate-600">登録後、作業日報の名前欄から選択できます。</p>
            <label className="mt-4 block text-sm font-bold">ドライバー名<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：四宮" value={driverMasterName} onChange={(event) => setDriverMasterName(event.target.value)} /></label>
            <button type="submit" disabled={loading || !masterReady} className="mt-5 w-full bg-emerald-800 px-4 py-3 font-black text-white disabled:opacity-50">ドライバーを登録</button>
          </form>
          <form className="panel rounded-none p-5" onSubmit={addItemType}>
            <h3 className="text-lg font-black">台数管理の種類を追加</h3>
            <p className="mt-2 text-sm text-slate-600">新しいカゴや貸出備品を追加すると、日報入力と管理表から選択できます。</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
              <label className="text-sm font-bold">区分<select className="mt-2 w-full border border-slate-300 bg-white px-4 py-3" value={itemCategory} onChange={(event) => setItemCategory(event.target.value as QuantityAssetType)}><option value="カゴ">カゴ</option><option value="貸出備品">貸出備品</option></select></label>
              <label className="text-sm font-bold">種類名<input className="mt-2 w-full border border-slate-300 px-4 py-3" required placeholder="例：3㎥カゴ／ドラム缶" value={itemTypeName} onChange={(event) => setItemTypeName(event.target.value)} /></label>
            </div>
            <button type="submit" disabled={loading || !masterReady} className="mt-5 w-full bg-emerald-800 px-4 py-3 font-black text-white disabled:opacity-50">種類を追加</button>
          </form>
        </div>
        <section className="panel rounded-none p-5">
          <h3 className="text-lg font-black">ドライバー・台数管理の登録済み一覧</h3>
          <p className="mt-2 text-sm text-slate-600">誤って追加したドライバーは削除できます。種類は名称・区分の修正、または未使用の場合に削除できます。</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div><h4 className="font-black text-slate-800">ドライバー</h4><div className="mt-3 flex flex-wrap gap-2">{drivers.map((driver) => <span key={driver.id} className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm"><span>{driver.name}</span><button type="button" className="text-rose-700" aria-label={`${driver.name}を削除`} onClick={() => void deleteDriver(driver)}><Trash2 className="h-4 w-4" /></button></span>)}</div></div>
            <div><h4 className="font-black text-slate-800">カゴ・貸出備品の種類</h4><div className="mt-3 space-y-2">{itemTypes.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-2 text-sm"><span><strong>{item.category}</strong>｜{item.name}</span><span className="flex shrink-0 gap-2"><button type="button" className="inline-flex items-center gap-1 font-black text-amber-800" onClick={() => startItemTypeEdit(item)}><PencilLine className="h-4 w-4" />修正</button><button type="button" className="inline-flex items-center gap-1 font-black text-rose-700" onClick={() => void deleteItemType(item)}><Trash2 className="h-4 w-4" />削除</button></span></div>)}</div></div>
          </div>
        </section>
        {itemTypeEdit ? <form id="item-type-edit-form" className="panel scroll-mt-5 rounded-none border-l-8 border-amber-600 bg-amber-50 p-5" onSubmit={saveItemTypeEdit}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-amber-950">種類を修正</h3><p className="mt-2 text-sm text-amber-900">既存の台数・履歴・管理表も新しい名称へ統一します。</p></div><button type="button" className="inline-flex items-center gap-2 border border-amber-700 bg-white px-4 py-2 text-sm font-bold text-amber-900" onClick={() => setItemTypeEdit(null)}><X className="h-4 w-4" />閉じる</button></div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]"><label className="text-sm font-bold">区分<select className="mt-2 w-full border border-amber-400 bg-white px-4 py-3" value={itemTypeEdit.category} onChange={(event) => setItemTypeEdit({ ...itemTypeEdit, category: event.target.value as QuantityAssetType })}><option value="カゴ">カゴ</option><option value="貸出備品">貸出備品</option></select></label><label className="text-sm font-bold">種類名<input required className="mt-2 w-full border border-amber-400 bg-white px-4 py-3" value={itemTypeEdit.name} onChange={(event) => setItemTypeEdit({ ...itemTypeEdit, name: event.target.value })} /></label></div>
          <button type="submit" disabled={loading} className="mt-5 bg-amber-700 px-6 py-3 font-black text-white disabled:opacity-50">種類の修正を保存</button>
        </form> : null}
        {customerEdit ? <form id="customer-edit-form" className="panel scroll-mt-5 rounded-none border-l-8 border-amber-600 bg-amber-50 p-5" onSubmit={saveCustomerEdit}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">排出事業者を修正</h3><p className="mt-2 text-sm text-slate-600">社名を変更すると、変更後の入力は「現社名（旧社名：直前の社名）」で保存されます。過去の履歴は変更しません。</p></div><button type="button" className="inline-flex items-center gap-2 border border-slate-300 px-4 py-2 text-sm font-bold" onClick={() => setCustomerEdit(null)}><X className="h-4 w-4" />閉じる</button></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-sm font-bold">顧客番号<input required className="mt-2 w-full border border-slate-300 px-4 py-3" value={customerEdit.customerCode} onChange={(event) => setCustomerEdit({ ...customerEdit, customerCode: event.target.value })} /></label><label className="text-sm font-bold">排出事業者名<input required className="mt-2 w-full border border-slate-300 px-4 py-3" value={customerEdit.name} onChange={(event) => setCustomerEdit({ ...customerEdit, name: event.target.value })} /></label><label className="text-sm font-bold">カナ<input className="mt-2 w-full border border-slate-300 px-4 py-3" value={customerEdit.nameKana} onChange={(event) => setCustomerEdit({ ...customerEdit, nameKana: event.target.value })} /></label></div>
          {customerEdit.previousName ? <p className="mt-3 text-sm text-slate-600">現在保持している旧社名：{customerEdit.previousName}</p> : null}
          <button type="submit" disabled={loading} className="mt-5 bg-emerald-800 px-6 py-3 font-black text-white disabled:opacity-50">修正を保存</button>
        </form> : null}
        {siteEdit ? <form id="site-edit-form" className="panel scroll-mt-5 rounded-none border-l-8 border-amber-600 bg-amber-50 p-5" onSubmit={saveSiteEdit}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">現場を修正</h3><p className="mt-2 text-sm text-slate-600">変更後に登録する日報から、新しい現場名を使用します。</p></div><button type="button" className="inline-flex items-center gap-2 border border-slate-300 px-4 py-2 text-sm font-bold" onClick={() => setSiteEdit(null)}><X className="h-4 w-4" />閉じる</button></div>
          <div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-sm font-bold">現場番号<input required className="mt-2 w-full border border-slate-300 px-4 py-3" value={siteEdit.siteCode} onChange={(event) => setSiteEdit({ ...siteEdit, siteCode: event.target.value })} /></label><label className="text-sm font-bold">現場名<input required className="mt-2 w-full border border-slate-300 px-4 py-3" value={siteEdit.name} onChange={(event) => setSiteEdit({ ...siteEdit, name: event.target.value })} /></label><label className="text-sm font-bold">カナ<input className="mt-2 w-full border border-slate-300 px-4 py-3" value={siteEdit.nameKana} onChange={(event) => setSiteEdit({ ...siteEdit, nameKana: event.target.value })} /></label></div>
          <button type="submit" disabled={loading} className="mt-5 bg-emerald-800 px-6 py-3 font-black text-white disabled:opacity-50">修正を保存</button>
        </form> : null}
        {errors.length ? <div className="border-l-8 border-rose-700 bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-900">{errors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        {masterMessage ? <p className="bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{masterMessage}</p> : null}
        <section className="panel rounded-none p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div><h3 className="text-lg font-black">登録済み一覧</h3><p className="mt-2 text-sm text-slate-600">排出事業者 {customers.length}件／現場 {sites.length}件（表示 {filteredCustomers.length}件）</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-bold text-slate-700">一覧を検索
                <span className="mt-2 flex min-w-72 border border-slate-300 bg-white px-3"><Search className="my-auto h-5 w-5 text-slate-500" /><input className="w-full px-3 py-3 outline-none" placeholder="番号・名称・カナ・現場名" value={masterQuery} onChange={(event) => setMasterQuery(event.target.value)} /></span>
              </label>
              <label className="text-sm font-bold text-slate-700">並び順
                <select className="mt-2 block min-w-44 border border-slate-300 bg-white px-4 py-3" value={customerSort} onChange={(event) => setCustomerSort(event.target.value as 'code' | 'kana')}>
                  <option value="code">顧客番号順</option>
                  <option value="kana">カナ順</option>
                </select>
              </label>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1080px] table-fixed text-sm"><colgroup><col className="w-32" /><col className="w-72" /><col className="w-72" /><col /></colgroup><thead className="bg-slate-100"><tr>{['顧客番号', '排出事業者名', 'カナ', '登録済み現場（現場番号順）'].map((title) => <th key={title} className="border border-slate-200 px-3 py-3 text-left">{title}</th>)}</tr></thead><tbody>{filteredCustomers.map((customer) => {
            const customerSites = sitesByCode.filter((site) => site.customerId === customer.id)
            const expanded = expandedCustomerIds.has(customer.id)
            const visibleSites = expanded ? customerSites : customerSites.slice(0, 3)
            return <tr key={customer.id} className="align-top"><td className="border border-slate-200 px-3 py-3 font-bold"><p>{customer.customerCode}</p><button type="button" className="mt-3 inline-flex items-center gap-1 bg-amber-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700" onClick={() => startCustomerEdit(customer)}><PencilLine className="h-3 w-3" />排出事業者を修正</button></td><td className="border border-slate-200 px-3 py-3 break-words"><p>{customer.name}</p>{customer.previousName ? <p className="mt-1 text-xs text-slate-500">旧社名：{customer.previousName}</p> : null}</td><td className="border border-slate-200 px-3 py-3 break-words">{customer.nameKana}</td><td className="border border-slate-200 px-3 py-3">{visibleSites.length ? <div className="space-y-2">{visibleSites.map((site) => <div key={site.id} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><p><strong>{site.siteCode}</strong> {site.name}{site.nameKana ? <span className="ml-2 text-xs text-slate-500">（{site.nameKana}）</span> : null}</p><button type="button" className="shrink-0 bg-amber-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-amber-700" onClick={() => startSiteEdit(site)}><PencilLine className="mr-1 inline h-3 w-3" />現場を修正</button></div>)}</div> : '未登録'}{customerSites.length > 3 ? <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-800 underline" onClick={() => setExpandedCustomerIds((current) => { const next = new Set(current); if (next.has(customer.id)) next.delete(customer.id); else next.add(customer.id); return next })}>{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{expanded ? '3件表示に戻す' : `残り${customerSites.length - 3}件を表示`}</button> : null}</td></tr>
          })}</tbody></table></div>
          {!filteredCustomers.length ? <p className="mt-4 bg-slate-50 px-4 py-5 text-center text-sm font-bold text-slate-600">該当する排出事業者・現場はありません。</p> : null}
        </section>
      </section> : null}

      {activeTab === 'corrections' ? <section className="space-y-6">
        <section className="panel rounded-none p-5">
          <div className="flex items-start gap-3"><PencilLine className="h-8 w-8 text-emerald-800" /><div><h2 className="text-xl font-black">入力履歴・訂正</h2><p className="mt-2 text-sm leading-6 text-slate-600">運用開始後に登録した日報を検索して訂正できます。保存すると、現在の設置状況・コンテナ管理表・収集履歴も自動で再計算されます。</p></div></div>
          <form className="mt-5 grid gap-4 md:grid-cols-[190px_1fr_auto] md:items-end" onSubmit={(event) => { event.preventDefault(); void loadCorrectionReports() }}>
            <label className="text-sm font-bold text-slate-700">日付
              <input type="date" className="mt-2 block w-full border border-slate-300 bg-white px-4 py-3" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} />
            </label>
            <label className="text-sm font-bold text-slate-700">検索語
              <span className="mt-2 flex border border-slate-300 bg-white px-3"><Search className="my-auto h-5 w-5 text-slate-500" /><input className="w-full px-3 py-3 outline-none" placeholder="排出事業者・現場・ドライバー・コンテナ番号" value={correctionQuery} onChange={(event) => setCorrectionQuery(event.target.value)} /></span>
            </label>
            <button type="submit" disabled={correctionLoading} className="bg-emerald-800 px-6 py-3 font-black text-white disabled:opacity-50">{correctionLoading ? '検索中…' : '履歴を検索'}</button>
          </form>
          <p className="mt-3 text-xs leading-6 text-slate-500">初期登録データは保護対象のため、この画面には表示されません。条件なしの場合は最新100件を表示します。</p>
        </section>

        {correctionErrors.length ? <div className="border-l-8 border-rose-700 bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-900">{correctionErrors.map((error) => <p key={error}>{error}</p>)}</div> : null}
        {correctionMessage ? <p className="bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">{correctionMessage}</p> : null}

        {correctionDraft ? <form id="correction-form" className="panel scroll-mt-5 rounded-none p-5" onSubmit={saveCorrection}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-black">選択した入力を訂正</h3><p className="mt-2 text-sm text-slate-600">登録番号：{correctionDraft.reportId}</p></div>
            <button type="button" className="inline-flex items-center gap-2 border border-slate-300 px-4 py-2 text-sm font-bold" onClick={() => setCorrectionDraft(null)}><X className="h-4 w-4" />閉じる</button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-bold">日付<input type="date" required className="mt-2 w-full border border-slate-300 px-4 py-3" value={correctionDraft.workDate} onChange={(event) => updateCorrection({ workDate: event.target.value })} /></label>
            <label className="text-sm font-bold">名前（ドライバー）<select required className="mt-2 w-full border border-slate-300 bg-white px-4 py-3" value={correctionDraft.driverName} onChange={(event) => updateCorrection({ driverName: event.target.value })}><option value="">選択してください</option>{drivers.map((driver) => <option key={driver.id} value={driver.name}>{driver.name}</option>)}{correctionDraft.driverName && !drivers.some((driver) => driver.name === correctionDraft.driverName) ? <option value={correctionDraft.driverName}>{correctionDraft.driverName}</option> : null}</select></label>
            <label className="text-sm font-bold">排出事業者
              <input required className="mt-2 w-full border border-slate-300 px-4 py-3" list="correction-customer-options" placeholder="番号・名称・カナで検索" value={correctionCustomer ? customerOption(correctionCustomer) : correctionDraft.companyName} onChange={(event) => updateCorrectionCustomer(event.target.value)} />
              <datalist id="correction-customer-options">{customersByCode.map((customer) => <option key={customer.id} value={customerOption(customer)} />)}</datalist>
            </label>
            <label className="text-sm font-bold">現場
              <input required className="mt-2 w-full border border-slate-300 px-4 py-3" list="correction-site-options" placeholder={correctionDraft.customerId ? '番号・名称・カナで検索' : '先に排出事業者を選択'} value={correctionSite ? siteOption(correctionSite) : correctionDraft.siteName} onChange={(event) => updateCorrectionSite(correctionDraft.customerId, event.target.value)} />
              <datalist id="correction-site-options">{correctionSiteOptions.map((site) => <option key={site.id} value={siteOption(site)} />)}</datalist>
            </label>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {isQuantityEntry(correctionDraft) ? <>
              <label className="text-sm font-bold">種類<select required className="mt-2 w-full border border-slate-300 bg-white px-4 py-3" value={correctionDraft.basketType} onChange={(event) => updateCorrection({ basketType: event.target.value })}><option value="">種類を選択</option>{itemTypes.filter((item) => item.category === quantityCategory(correctionDraft)).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
              <label className="text-sm font-bold">設置台数<input type="number" min="0" step="1" inputMode="numeric" className="mt-2 w-full border border-slate-300 px-4 py-3" value={correctionDraft.basketInstallCount} onChange={(event) => updateCorrection({ basketInstallCount: event.target.value })} /></label>
              <label className="text-sm font-bold">引上げ台数<input type="number" min="0" step="1" inputMode="numeric" className="mt-2 w-full border border-slate-300 px-4 py-3" value={correctionDraft.basketCollectCount} onChange={(event) => updateCorrection({ basketCollectCount: event.target.value })} /></label>
            </> : <>
              <label className="text-sm font-bold">設置<input autoCapitalize="characters" className="mt-2 w-full border border-slate-300 px-4 py-3" placeholder="例：203" value={assetIdentifier(correctionDraft.installAssetId)} onChange={(event) => updateCorrection({ installAssetId: normalizeAssetIdentifier(event.target.value) })} /></label>
              <label className="text-sm font-bold">引上げ<input autoCapitalize="characters" className="mt-2 w-full border border-slate-300 px-4 py-3" placeholder="例：208" value={assetIdentifier(correctionDraft.collectAssetId)} onChange={(event) => updateCorrection({ collectAssetId: normalizeAssetIdentifier(event.target.value) })} /></label>
            </>}
            <label className={`text-sm font-bold ${correctionDraft.entryType === 'container' ? 'md:col-span-2' : ''}`}>受託数量・備考<textarea className="mt-2 min-h-12 w-full border border-slate-300 px-4 py-3" value={correctionDraft.quantityNote} onChange={(event) => updateCorrection({ quantityNote: event.target.value })} /></label>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <p className="text-sm font-bold text-slate-700">訂正後の自動判定：<span className={`ml-2 inline-flex px-3 py-1 text-xs font-black ${typeColor(workType(correctionDraft))}`}>{workType(correctionDraft)}</span></p>
            <button type="submit" disabled={correctionLoading} className="inline-flex items-center gap-2 bg-emerald-800 px-6 py-3 font-black text-white disabled:opacity-50"><PencilLine className="h-5 w-5" />{correctionLoading ? '再計算中…' : '訂正を保存して再計算'}</button>
          </div>
        </form> : null}

        <section className="panel rounded-none p-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-lg font-black">運用開始後の入力履歴</h3><p className="mt-2 text-sm text-slate-600">表示 {correctionRows.length}件</p></div></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1050px] text-sm"><thead className="bg-slate-100"><tr>{['日付', '排出事業者', '現場', 'ドライバー', '設置', '引上げ', '受託数量・備考', ''].map((title) => <th key={title} className="border border-slate-200 px-3 py-3 text-left">{title}</th>)}</tr></thead><tbody>{correctionRows.map((report) => {
            const installLabel = isQuantityAssetType(report.assetType) ? `${report.sizeLabel}×${report.basketInstallCount ?? 0}` : report.installAssetLabel ?? ''
            const collectLabel = isQuantityAssetType(report.assetType) ? `${report.sizeLabel}×${report.basketCollectCount ?? 0}` : report.collectAssetLabel ?? ''
            return <tr key={report.id}><td className="border border-slate-200 px-3 py-3 font-bold">{formatDate(report.workDate)}</td><td className="border border-slate-200 px-3 py-3">{report.companyName}</td><td className="border border-slate-200 px-3 py-3">{report.siteName}</td><td className="border border-slate-200 px-3 py-3">{report.driverName}</td><td className="border border-slate-200 px-3 py-3">{installLabel}</td><td className="border border-slate-200 px-3 py-3">{collectLabel}</td><td className="whitespace-pre-wrap border border-slate-200 px-3 py-3">{report.note ?? report.quantity}</td><td className="border border-slate-200 px-3 py-3"><div className="flex gap-2"><button type="button" className="inline-flex items-center gap-2 border border-emerald-700 px-3 py-2 font-black text-emerald-800" onClick={() => startCorrection(report)}><PencilLine className="h-4 w-4" />訂正</button><button type="button" className="inline-flex items-center gap-2 border border-rose-700 px-3 py-2 font-black text-rose-700" onClick={() => void deleteReport(report)}><Trash2 className="h-4 w-4" />削除</button></div></td></tr>
          })}</tbody></table></div>
          {!correctionLoading && !correctionRows.length ? <p className="mt-4 bg-slate-50 px-4 py-5 text-center text-sm font-bold text-slate-600">該当する入力履歴はありません。</p> : null}
        </section>
      </section> : null}

      {activeTab === 'container-ledger' ? <section className="space-y-5">
        <div className="no-print panel rounded-none p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <label className="block text-sm font-bold text-slate-700">管理対象
              <input className="mt-2 block min-w-80 border border-slate-300 bg-white px-4 py-3" list="container-ledger-options" placeholder="コンテナ番号・カゴ・貸出備品を検索" value={ledgerAssetQuery} onChange={(event) => selectLedgerAsset(event.target.value)} />
              <datalist id="container-ledger-options">{assetOptions.map((item) => <option key={item.id} value={item.label}>{item.kind === 'quantity' ? item.category : item.sizeLabel || 'コンテナ'}</option>)}</datalist>
            </label>
            <button type="button" className="inline-flex items-center justify-center gap-2 bg-emerald-800 px-5 py-3 font-black text-white" onClick={() => printSheet('container-ledger')}><Printer className="h-5 w-5" />A4 PDF・印刷</button>
          </div>
        </div>
        {sheetLoading ? <p className="no-print text-sm font-bold text-emerald-800">帳票データを読み込み中です…</p> : null}
        <div className={`paper-sheet paper-portrait ${printTarget === 'container-ledger' ? 'print-target' : ''}`}>
          <div className="paper-title-row"><p>{selectedLedgerOption?.kind === 'quantity' ? '種類' : 'No.'} <span>{selectedLedgerOption?.label.replace('番', '') ?? ''}</span></p><h2>コンテナ管理表</h2></div>
          <table className="paper-table container-ledger-table">
            <thead><tr><th>設置年月日</th><th>回収年月日</th><th>排出事業者名</th><th>現場名</th><th>台数</th></tr></thead>
            <tbody>{Array.from({ length: Math.max(24, ledgerRows.length) }, (_, index) => {
              const report = ledgerRows[index]
              return <tr key={report?.id ?? `empty-${index}`}><td>{report ? formatDate(report.installedOn) : ''}</td><td>{report?.collectedOn ? formatDate(report.collectedOn) : ''}</td><td>{report?.companyName ?? ''}</td><td>{report?.siteName ?? ''}</td><td>{report?.quantity ?? ''}</td></tr>
            })}</tbody>
          </table>
        </div>
      </section> : null}

      {activeTab === 'collection-history' ? <section className="space-y-5">
        <div className="no-print panel rounded-none p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <label className="block text-sm font-bold text-slate-700">排出事業者名
              <input className="mt-2 block w-full border border-slate-300 bg-white px-4 py-3" list="history-company-options" placeholder="顧客番号・名称・カナで検索" value={historyCompany} onChange={(event) => selectHistoryCustomer(event.target.value)} />
              <datalist id="history-company-options">{companyOptions.map((company) => <option key={company.id} value={customerOption(company)} />)}</datalist>
            </label>
            <label className="block text-sm font-bold text-slate-700">管理年
              <select className="mt-2 block w-full border border-slate-300 bg-white px-4 py-3" value={historyYear} onChange={(event) => { setHistoryYear(event.target.value); setHistoryRows([]) }}>{years.map((year) => <option key={year} value={year}>{year}年</option>)}</select>
            </label>
            <button type="button" className="inline-flex items-center justify-center gap-2 bg-emerald-800 px-5 py-3 font-black text-white" onClick={() => printSheet('collection-history')}><Printer className="h-5 w-5" />A4 PDF・印刷</button>
          </div>
          <p className="mt-3 text-sm text-slate-600">排出事業者名と年を選ぶと、1年分の収集履歴を紙と同じ形式で保存できます。</p>
        </div>
        {sheetLoading ? <p className="no-print text-sm font-bold text-emerald-800">帳票データを読み込み中です…</p> : null}
        <div className={`paper-sheet paper-portrait ${printTarget === 'collection-history' ? 'print-target' : ''}`}>
          <div className="collection-heading"><div><span>排出事業者名</span><strong>{historyHeadingCompany}</strong></div><h2>収集履歴</h2><p>{historyYear}年</p></div>
          <table className="paper-table collection-table">
            <colgroup><col style={{ width: '13%' }} /><col style={{ width: '23%' }} /><col style={{ width: '12%' }} /><col style={{ width: '8%' }} /><col style={{ width: '8%' }} /><col style={{ width: '36%' }} /></colgroup>
            <thead><tr><th rowSpan={2}>収集年月日</th><th rowSpan={2}>現場名（工事件名）及び住所</th><th rowSpan={2}>運搬者</th><th colSpan={2}>コンテナ番号</th><th rowSpan={2}>品目・数量及び処分先・備考</th></tr><tr><th>設置</th><th>回収</th></tr></thead>
            <tbody>{Array.from({ length: Math.max(18, historyRows.length) }, (_, index) => {
              const report = historyRows[index]
              const installLabel = report && isQuantityAssetType(report.assetType) && report.basketInstallCount
                ? `${report.sizeLabel || 'カゴ'}×${report.basketInstallCount}`
                : report?.installAssetLabel?.replace('番', '') ?? ''
              const collectLabel = report && isQuantityAssetType(report.assetType) && report.basketCollectCount
                ? `${report.sizeLabel || 'カゴ'}×${report.basketCollectCount}`
                : report?.collectAssetLabel?.replace('番', '') ?? ''
              return <tr key={report?.id ?? `empty-${index}`}><td>{report ? formatDate(report.workDate) : ''}</td><td>{report?.siteName ?? ''}</td><td>{report?.driverName ?? ''}</td><td>{installLabel}</td><td>{collectLabel}</td><td className="whitespace-pre-wrap">{report?.note ?? report?.quantity ?? ''}</td></tr>
            })}</tbody>
          </table>
        </div>
      </section> : null}
    </div>
  )
}
