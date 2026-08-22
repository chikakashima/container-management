'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, PackageCheck, Plus, Printer, RotateCcw, Search, Trash2, Truck } from 'lucide-react'
import {
  containerAssets,
  initialAssignments,
  initialReports,
  longTermThresholds,
  type ContainerAssignment,
  type ContainerReport,
  type ContainerWorkType,
  type LongTermThreshold,
} from '@/lib/container-data'

type ReportRow = {
  id: string
  companyName: string
  siteName: string
  installAssetId: string
  collectAssetId: string
  quantityNote: string
}

type AppTab = 'daily' | 'container-ledger' | 'collection-history'
type PrintTarget = 'container-ledger' | 'collection-history' | null

const storageKey = 'genba-container-management-v2'

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return `${year}/${Number(month)}/${Number(day)}`
}

function daysFrom(value: string) {
  const start = new Date(`${value}T12:00:00`).getTime()
  const end = new Date(`${today()}T12:00:00`).getTime()
  return Math.max(0, Math.floor((end - start) / 86_400_000))
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s/g, '')
}

function emptyRow(id = `row-${Date.now()}-${Math.random()}`): ReportRow {
  return { id, companyName: '', siteName: '', installAssetId: '', collectAssetId: '', quantityNote: '' }
}

function defaultRows(): ReportRow[] {
  return [
    {
      ...emptyRow('sample'),
      companyName: '○○建設',
      siteName: '同左',
      installAssetId: 'container-oki-1',
      collectAssetId: 'container-408',
      quantityNote: '2.5m3コンテナ 1基',
    },
    emptyRow('row-2'),
    emptyRow('row-3'),
  ]
}

function workType(row: ReportRow): ContainerWorkType {
  if (row.installAssetId && row.collectAssetId) return '交換'
  if (row.installAssetId) return '設置'
  if (row.collectAssetId) return '回収'
  return '手積み'
}

function hasContent(row: ReportRow) {
  return Boolean(row.companyName.trim() || row.siteName.trim() || row.installAssetId || row.collectAssetId || row.quantityNote.trim())
}

function asset(assetId: string) {
  if (!assetId) return undefined
  const digits = assetId.replace(/\D/g, '')
  const known = containerAssets.find((item) => item.id === assetId || (digits && item.label.replace(/\D/g, '') === digits))
  if (known) return known
  return digits ? { id: `container-${digits}`, label: digits, assetType: 'コンテナ' as const, sizeLabel: '' } : undefined
}

function assetNumber(assetId: string) {
  if (!assetId) return ''
  return asset(assetId)?.label.replace(/\D/g, '') ?? assetId.replace(/\D/g, '')
}

function typeColor(type: ContainerWorkType) {
  if (type === '交換') return 'bg-violet-100 text-violet-800'
  if (type === '設置') return 'bg-emerald-100 text-emerald-800'
  if (type === '回収') return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-800'
}

function loadData() {
  const fallback = { assignments: initialAssignments, reports: initialReports, thresholds: longTermThresholds }
  if (typeof window === 'undefined') return fallback
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '') as typeof fallback
    return {
      assignments: parsed.assignments?.length ? parsed.assignments : initialAssignments,
      reports: parsed.reports?.length ? parsed.reports : initialReports,
      thresholds: parsed.thresholds?.length ? parsed.thresholds : longTermThresholds,
    }
  } catch {
    return fallback
  }
}

function fiscalYears(reports: ContainerReport[]) {
  return Array.from(new Set(reports.map((report) => report.workDate.slice(0, 4)))).sort((a, b) => b.localeCompare(a))
}

export function ContainerManagement() {
  const [stored, setStored] = useState(loadData)
  const [workDate, setWorkDate] = useState(today())
  const [driverName, setDriverName] = useState('')
  const [rows, setRows] = useState<ReportRow[]>(defaultRows)
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [companyQuery, setCompanyQuery] = useState('○○建設')
  const [containerQuery, setContainerQuery] = useState('')
  const [activeTab, setActiveTab] = useState<AppTab>('daily')
  const [ledgerAssetId, setLedgerAssetId] = useState(containerAssets.find((item) => item.assetType === 'コンテナ')?.id ?? '')
  const [ledgerAssetQuery, setLedgerAssetQuery] = useState(containerAssets.find((item) => item.assetType === 'コンテナ')?.label ?? '')
  const [historyCompany, setHistoryCompany] = useState('○○建設')
  const [historyYear, setHistoryYear] = useState('2026')
  const [printTarget, setPrintTarget] = useState<PrintTarget>(null)

  const active = useMemo(() => stored.assignments.filter((item) => !item.collectedOn), [stored.assignments])
  const longTerm = useMemo(
    () => active.map((item) => ({ ...item, elapsedDays: daysFrom(item.installedOn) })).sort((a, b) => b.elapsedDays - a.elapsedDays),
    [active],
  )
  const searchResults = useMemo(() => {
    if (containerQuery.trim()) return active.filter((item) => normalize(item.assetLabel).includes(normalize(containerQuery)))
    if (companyQuery.trim()) return active.filter((item) => normalize(item.companyName).includes(normalize(companyQuery)))
    return active
  }, [active, companyQuery, containerQuery])
  const companies = useMemo(() => Array.from(new Set(stored.reports.map((report) => report.companyName))).sort((a, b) => a.localeCompare(b, 'ja')), [stored.reports])
  const years = useMemo(() => fiscalYears(stored.reports), [stored.reports])
  const selectedAsset = asset(ledgerAssetId)
  const ledgerRows = useMemo(
    () => stored.reports.filter((report) => report.installAssetId === ledgerAssetId || report.collectAssetId === ledgerAssetId).sort((a, b) => a.workDate.localeCompare(b.workDate)),
    [ledgerAssetId, stored.reports],
  )
  const historyRows = useMemo(
    () => stored.reports.filter((report) => report.companyName === historyCompany && report.workDate.startsWith(`${historyYear}-`)).sort((a, b) => a.workDate.localeCompare(b.workDate)),
    [historyCompany, historyYear, stored.reports],
  )

  function printSheet(target: Exclude<PrintTarget, null>) {
    setPrintTarget(target)
    window.setTimeout(() => {
      window.print()
      setPrintTarget(null)
    }, 80)
  }

  function selectLedgerAsset(value: string) {
    setLedgerAssetQuery(value)
    const exact = containerAssets.find((item) => item.label === value || `${item.label}（${item.sizeLabel}・${item.assetType}）` === value)
    if (exact) setLedgerAssetId(exact.id)
  }

  function persist(next: { assignments: ContainerAssignment[]; reports: ContainerReport[]; thresholds: LongTermThreshold[] }) {
    setStored(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  function updateRow(id: string, patch: Partial<ReportRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function validate(inputRows: ReportRow[]) {
    const next: string[] = []
    let working = active.map((item) => ({ ...item }))

    inputRows.forEach((row, index) => {
      const line = index + 1
      const install = asset(row.installAssetId)
      const collect = asset(row.collectAssetId)
      if (!row.companyName.trim()) next.push(`${line}行目：排出事業者名を入力してください。`)
      if (!row.quantityNote.trim()) next.push(`${line}行目：受託数量・備考を入力してください。`)
      if (row.installAssetId === row.collectAssetId && row.installAssetId) next.push(`${line}行目：設置と引上げは別の番号にしてください。`)

      if (install?.assetType === 'コンテナ') {
        const current = working.find((item) => item.assetId === install.id && !item.collectedOn)
        if (current) next.push(`${line}行目：${current.assetLabel}は現在、${current.companyName}に設置中です。`)
      }

      if (collect) {
        const current = working.find((item) =>
          item.assetId === collect.id && !item.collectedOn &&
          (collect.assetType !== 'カゴ' || normalize(item.companyName) === normalize(row.companyName)),
        )
        if (!current) next.push(`${line}行目：${collect.label}は現在設置中ではありません。`)
        else if (normalize(current.companyName) !== normalize(row.companyName)) {
          next.push(`${line}行目：${current.assetLabel}は別の排出事業者（${current.companyName}）に設置中です。`)
        } else {
          working = working.map((item) => item.id === current.id ? { ...item, collectedOn: workDate } : item)
        }
      }

      if (install) {
        working.push({
          id: `check-${row.id}`, assetId: install.id, assetLabel: install.label, assetType: install.assetType,
          sizeLabel: install.sizeLabel, companyName: row.companyName, siteName: row.siteName || '同左',
          installedOn: workDate, quantity: row.quantityNote,
        })
      }
    })
    return next
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const inputRows = rows.filter(hasContent)
    const nextErrors: string[] = []
    if (!workDate) nextErrors.push('日付を入力してください。')
    if (!driverName.trim()) nextErrors.push('名前（ドライバー）を入力してください。')
    if (!inputRows.length) nextErrors.push('作業明細を1行以上入力してください。')
    nextErrors.push(...validate(inputRows))
    setErrors(nextErrors)
    setMessage('')
    if (nextErrors.length) return

    const batch = Date.now()
    let assignments = stored.assignments.map((item) => ({ ...item }))
    const reports: ContainerReport[] = []

    inputRows.forEach((row, index) => {
      const install = asset(row.installAssetId)
      const collect = asset(row.collectAssetId)
      if (collect) {
        const target = assignments.find((item) =>
          item.assetId === collect.id && !item.collectedOn &&
          (collect.assetType !== 'カゴ' || normalize(item.companyName) === normalize(row.companyName)),
        )
        if (target) assignments = assignments.map((item) => item.id === target.id ? { ...item, collectedOn: workDate } : item)
      }

      const report: ContainerReport = {
        id: `report-${batch}-${index}`, workDate, companyName: row.companyName.trim(),
        siteName: row.siteName.trim() || '同左', driverName: driverName.trim(), workType: workType(row),
        installAssetId: install?.id, installAssetLabel: install?.label, collectAssetId: collect?.id,
        collectAssetLabel: collect?.label, assetType: install?.assetType ?? collect?.assetType ?? '手積み',
        sizeLabel: install?.sizeLabel ?? collect?.sizeLabel ?? '手積み', quantity: row.quantityNote.trim(),
        note: row.quantityNote.trim(),
      }
      reports.push(report)
      if (install) {
        assignments.unshift({
          id: `assign-${batch}-${index}`, assetId: install.id, assetLabel: install.label,
          assetType: install.assetType, sizeLabel: install.sizeLabel, companyName: report.companyName,
          siteName: report.siteName, installedOn: workDate, quantity: report.quantity, note: report.note,
        })
      }
    })

    persist({ assignments, reports: [...reports, ...stored.reports], thresholds: stored.thresholds })
    setCompanyQuery(reports[0]?.companyName ?? '')
    setContainerQuery(reports[0]?.installAssetLabel ?? reports[0]?.collectAssetLabel ?? '')
    setRows([emptyRow(), emptyRow(), emptyRow()])
    setMessage(`${formatDate(workDate)}の日報を${reports.length}件登録し、管理表へ反映しました。`)
  }

  function reset() {
    persist({ assignments: initialAssignments, reports: initialReports, thresholds: longTermThresholds })
    setRows(defaultRows())
    setDriverName('')
    setErrors([])
    setMessage('見本データに戻しました。')
  }

  return (
    <div className="space-y-6">
      <nav className="no-print panel grid rounded-none p-2 sm:grid-cols-3" aria-label="管理メニュー">
        {([
          ['daily', '日報入力・設置状況'],
          ['container-ledger', 'コンテナ管理表'],
          ['collection-history', '収集履歴'],
        ] as const).map(([tab, label]) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-4 py-4 text-sm font-black transition ${activeTab === tab ? 'bg-emerald-800 text-white' : 'bg-white text-slate-700 hover:bg-emerald-50'}`}>
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'daily' ? <>
      <section className="grid gap-4 xl:grid-cols-3">
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
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead className="bg-slate-100"><tr>
              {['No.', '排出事業者名', '現場名', '設置', '引上げ', '受託数量・備考', '自動判定', ''].map((title) => <th key={title} className="border border-slate-300 px-3 py-3 text-left">{title}</th>)}
            </tr></thead>
            <tbody>{rows.map((row, index) => {
              const type = workType(row)
              return <tr key={row.id} className="bg-white align-top">
                <td className="border border-slate-300 px-3 py-4 text-center font-black">{index + 1}</td>
                <td className="border border-slate-300 p-2"><input className="w-full min-w-40 border border-slate-200 px-3 py-3" placeholder="排出事業者名" value={row.companyName} onChange={(event) => updateRow(row.id, { companyName: event.target.value })} /></td>
                <td className="border border-slate-300 p-2"><input className="w-full min-w-40 border border-slate-200 px-3 py-3" placeholder="現場名（同左も可）" value={row.siteName} onChange={(event) => updateRow(row.id, { siteName: event.target.value })} /></td>
                <td className="border border-slate-300 p-2"><input inputMode="numeric" pattern="[0-9]*" className="w-full border border-slate-200 px-3 py-3" placeholder="例：408" value={assetNumber(row.installAssetId)} onChange={(event) => updateRow(row.id, { installAssetId: event.target.value.replace(/\D/g, '') })} /></td>
                <td className="border border-slate-300 p-2"><input inputMode="numeric" pattern="[0-9]*" className="w-full border border-slate-200 px-3 py-3" placeholder="例：210" value={assetNumber(row.collectAssetId)} onChange={(event) => updateRow(row.id, { collectAssetId: event.target.value.replace(/\D/g, '') })} /></td>
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
          <button type="submit" className="bg-emerald-700 px-4 py-4 text-base font-black text-white">この日報を登録して管理表へ反映</button>
          <button type="button" className="inline-flex items-center justify-center gap-2 border border-slate-300 px-4 py-4 text-sm font-black" onClick={reset}><RotateCcw className="h-5 w-5" />見本へ戻す</button>
        </div>
      </form>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="panel rounded-none p-5">
          <div className="flex items-start justify-between"><div><h2 className="text-xl font-black">今どこに何があるか</h2><p className="mt-2 text-sm text-slate-600">排出事業者名またはコンテナ番号で検索できます。</p></div><PackageCheck className="h-8 w-8 text-emerald-800" /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-bold">排出事業者名で検索<div className="mt-2 flex border border-slate-200 px-3"><Search className="my-auto h-5 w-5 text-slate-500" /><input className="w-full px-3 py-3 outline-none" value={companyQuery} onChange={(event) => setCompanyQuery(event.target.value)} /></div></label>
            <label className="text-sm font-bold">コンテナ番号で検索<div className="mt-2 flex border border-slate-200 px-3"><Search className="my-auto h-5 w-5 text-slate-500" /><input className="w-full px-3 py-3 outline-none" value={containerQuery} onChange={(event) => setContainerQuery(event.target.value)} /></div></label>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">{searchResults.map((item) => <article key={item.id} className="border-l-8 border-emerald-700 bg-emerald-50 p-5"><p className="font-bold text-emerald-900">{item.companyName}</p><h3 className="mt-2 text-3xl font-black">{item.assetLabel}</h3><div className="mt-4 space-y-2 text-sm font-bold text-slate-700"><p>設置日：{formatDate(item.installedOn)}</p><p>経過日数：{daysFrom(item.installedOn)}日</p><p>種類：{item.sizeLabel} {item.assetType}</p><p>現場名：{item.siteName}</p></div></article>)}</div>
        </section>
        <section className="panel rounded-none p-5"><h2 className="text-xl font-black">設置期間が長い順</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-100"><tr>{['経過', '番号', '排出事業者名', '現場名', '設置日'].map((title) => <th key={title} className="border border-slate-200 px-3 py-3 text-left">{title}</th>)}</tr></thead><tbody>{longTerm.slice(0, 12).map((item) => <tr key={item.id}><td className="border border-slate-200 px-3 py-3 font-black text-rose-700">{item.elapsedDays}日</td><td className="border border-slate-200 px-3 py-3 font-bold">{item.assetLabel}</td><td className="border border-slate-200 px-3 py-3">{item.companyName}</td><td className="border border-slate-200 px-3 py-3">{item.siteName}</td><td className="border border-slate-200 px-3 py-3">{formatDate(item.installedOn)}</td></tr>)}</tbody></table></div></section>
      </section>

      </> : null}

      {activeTab === 'container-ledger' ? <section className="space-y-5">
        <div className="no-print panel rounded-none p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <label className="block text-sm font-bold text-slate-700">コンテナ番号
              <input className="mt-2 block min-w-72 border border-slate-300 bg-white px-4 py-3" list="container-ledger-options" placeholder="番号を入力して検索" value={ledgerAssetQuery} onChange={(event) => selectLedgerAsset(event.target.value)} />
              <datalist id="container-ledger-options">{containerAssets.map((item) => <option key={item.id} value={item.label}>{item.sizeLabel}・{item.assetType}</option>)}</datalist>
            </label>
            <button type="button" className="inline-flex items-center justify-center gap-2 bg-emerald-800 px-5 py-3 font-black text-white" onClick={() => printSheet('container-ledger')}><Printer className="h-5 w-5" />A4 PDF・印刷</button>
          </div>
        </div>
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
              <input className="mt-2 block w-full border border-slate-300 bg-white px-4 py-3" list="history-company-options" placeholder="事業者名を入力して検索" value={historyCompany} onChange={(event) => setHistoryCompany(event.target.value)} />
              <datalist id="history-company-options">{companies.map((company) => <option key={company} value={company} />)}</datalist>
            </label>
            <label className="block text-sm font-bold text-slate-700">管理年
              <select className="mt-2 block w-full border border-slate-300 bg-white px-4 py-3" value={historyYear} onChange={(event) => setHistoryYear(event.target.value)}>{years.map((year) => <option key={year}>{year}年</option>)}</select>
            </label>
            <button type="button" className="inline-flex items-center justify-center gap-2 bg-emerald-800 px-5 py-3 font-black text-white" onClick={() => printSheet('collection-history')}><Printer className="h-5 w-5" />A4 PDF・印刷</button>
          </div>
          <p className="mt-3 text-sm text-slate-600">排出事業者名と年を選ぶと、1年分の収集履歴を紙と同じ形式で保存できます。</p>
        </div>
        <div className={`paper-sheet paper-landscape ${printTarget === 'collection-history' ? 'print-target' : ''}`}>
          <div className="collection-heading"><div><span>排出事業者名</span><strong>{historyCompany}</strong></div><h2>収集履歴</h2><p>{historyYear}年</p></div>
          <table className="paper-table collection-table">
            <thead><tr><th>収集年月日</th><th>現場名（工事件名）及び住所</th><th>運搬者</th><th colSpan={2}>コンテナ番号</th><th>品目・数量及び処分先・備考</th></tr><tr><th></th><th></th><th></th><th>設置</th><th>回収</th><th></th></tr></thead>
            <tbody>{Array.from({ length: Math.max(18, historyRows.length) }, (_, index) => {
              const report = historyRows[index]
              return <tr key={report?.id ?? `empty-${index}`}><td>{report ? formatDate(report.workDate) : ''}</td><td>{report?.siteName ?? ''}</td><td>{report?.driverName ?? ''}</td><td>{report?.installAssetLabel?.replace('番', '') ?? ''}</td><td>{report?.collectAssetLabel?.replace('番', '') ?? ''}</td><td>{report?.quantity ?? ''}{report?.note && report.note !== report.quantity ? ` ${report.note}` : ''}</td></tr>
            })}</tbody>
          </table>
        </div>
      </section> : null}
    </div>
  )
}
