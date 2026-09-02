export type ContainerAssetType = 'コンテナ' | 'カゴ'

export type ContainerWorkType = '設置' | '回収' | '交換' | '手積み'

export type ContainerAsset = {
  id: string
  label: string
  assetType: ContainerAssetType
  sizeLabel: string
  memo?: string
}

export type ContainerAssignment = {
  id: string
  assetId: string
  assetLabel: string
  assetType: ContainerAssetType
  sizeLabel: string
  companyName: string
  siteName: string
  installedOn: string
  collectedOn?: string
  quantity: string
  note?: string
  customerId?: string
  siteId?: string
}

export type ContainerReport = {
  id: string
  workDate: string
  companyName: string
  siteName: string
  driverName: string
  workType: ContainerWorkType
  installAssetId?: string
  installAssetLabel?: string
  collectAssetId?: string
  collectAssetLabel?: string
  assetType: ContainerAssetType | '手積み'
  sizeLabel: string
  quantity: string
  note?: string
  customerId?: string
  siteId?: string
  basketInstallCount?: number
  basketCollectCount?: number
  entryOrder?: number
}

export type CustomerMaster = {
  id: string
  customerCode: string
  name: string
  nameKana: string
}

export type SiteMaster = {
  id: string
  customerId: string
  siteCode: string
  name: string
  nameKana: string
}

export type BasketBalance = {
  id: string
  customerId: string
  siteId: string
  companyName: string
  siteName: string
  basketType: string
  quantity: number
}

export type LongTermThreshold = {
  id: string
  label: string
  days: number
}

export const containerAssets: ContainerAsset[] = [
  { id: 'container-oki-1', label: '置1番', assetType: 'コンテナ', sizeLabel: '2.5m3' },
  { id: 'container-408', label: '408番', assetType: 'コンテナ', sizeLabel: '2.5m3' },
  { id: 'container-222', label: '222番', assetType: 'コンテナ', sizeLabel: '4.5m3' },
  { id: 'container-223', label: '223番', assetType: 'コンテナ', sizeLabel: '4.5m3' },
  { id: 'container-213', label: '213番', assetType: 'コンテナ', sizeLabel: '5.5m3' },
  { id: 'container-206', label: '206番', assetType: 'コンテナ', sizeLabel: '6m3' },
  { id: 'container-215', label: '215番', assetType: 'コンテナ', sizeLabel: '5.5m3' },
  { id: 'container-210', label: '210番', assetType: 'コンテナ', sizeLabel: '5.5m3' },
  { id: 'basket-flex', label: 'カゴ・フレコン', assetType: 'カゴ', sizeLabel: 'フレコン' },
  { id: 'basket-board', label: 'カゴ・ボード', assetType: 'カゴ', sizeLabel: 'ボード用' },
]

export const longTermThresholds: LongTermThreshold[] = [
  { id: 'three-months', label: '3ヶ月以上', days: 90 },
  { id: 'six-months', label: '6ヶ月以上', days: 180 },
  { id: 'one-year', label: '1年以上', days: 365 },
]

export const initialAssignments: ContainerAssignment[] = [
  {
    id: 'assign-oki-1',
    assetId: 'container-oki-1',
    assetLabel: '置1番',
    assetType: 'コンテナ',
    sizeLabel: '2.5m3',
    companyName: '○○建設',
    siteName: '同左',
    installedOn: '2026-08-21',
    quantity: '1基',
  },
  {
    id: 'assign-210',
    assetId: 'container-210',
    assetLabel: '210番',
    assetType: 'コンテナ',
    sizeLabel: '5.5m3',
    companyName: 'ダイワプラスモア',
    siteName: '北関東営業所',
    installedOn: '2026-07-18',
    quantity: '1基',
  },
  {
    id: 'assign-basket-flex',
    assetId: 'basket-flex',
    assetLabel: 'カゴ・フレコン',
    assetType: 'カゴ',
    sizeLabel: 'フレコン',
    companyName: '市村板金',
    siteName: '事務所',
    installedOn: '2026-07-27',
    quantity: '2袋',
  },
  {
    id: 'assign-222',
    assetId: 'container-222',
    assetLabel: '222番',
    assetType: 'コンテナ',
    sizeLabel: '4.5m3',
    companyName: '資材置場',
    siteName: '資材置場',
    installedOn: '2026-03-18',
    quantity: '1基',
  },
]

export const initialReports: ContainerReport[] = [
  {
    id: 'report-001',
    workDate: '2026-08-21',
    companyName: '○○建設',
    siteName: '同左',
    driverName: '事務入力',
    workType: '交換',
    installAssetId: 'container-oki-1',
    installAssetLabel: '置1番',
    collectAssetId: 'container-408',
    collectAssetLabel: '408番',
    assetType: 'コンテナ',
    sizeLabel: '2.5m3',
    quantity: '1基',
    note: '紙日報から登録した見本',
  },
  {
    id: 'report-002',
    workDate: '2026-07-29',
    companyName: '菜穂電気',
    siteName: '作業場',
    driverName: '菜穂さん',
    workType: '交換',
    installAssetId: 'container-210',
    installAssetLabel: '210番',
    collectAssetId: 'container-215',
    collectAssetLabel: '215番',
    assetType: 'コンテナ',
    sizeLabel: '5.5m3',
    quantity: '1基',
  },
  {
    id: 'report-003',
    workDate: '2026-07-27',
    companyName: '市村板金',
    siteName: '事務所',
    driverName: '事務入力',
    workType: '設置',
    installAssetId: 'basket-flex',
    installAssetLabel: 'カゴ・フレコン',
    assetType: 'カゴ',
    sizeLabel: 'フレコン',
    quantity: '2袋',
  },
]
