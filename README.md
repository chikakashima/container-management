# コンテナ管理システム

産業廃棄物収集運搬会社向けのコンテナ管理システムです。VercelとSupabaseを利用します。

## 主な機能

- 紙の作業日報を見ながら1日分を一括入力
- 設置・引上げ番号から作業区分を自動判定
- 顧客番号・現場番号によるマスター管理とカナ検索
- 現場ごとのカゴ設置台数管理
- 複数ドライバーの日報を入力する順番に依存しない日次再計算
- コンテナの現在設置先を検索
- 二重設置・誤引上げの入力チェック
- 長期設置コンテナのアラート
- コンテナ管理表・収集履歴のA4印刷／PDF保存
- 運用開始後に入力した日報の検索・訂正と設置状況の再計算
- 訂正前後の内容・訂正者・訂正日時の監査記録

ドライバーは従来どおり紙へ記入し、事務員がPCから転記する運用を想定しています。

## データベース

Supabase SQL Editorで次の順にマイグレーションを実行します。

1. `supabase/migrations/202608270001_initial_container_management.sql`
2. `supabase/migrations/202609020001_customer_site_basket_management.sql`
3. `supabase/migrations/202609050001_initial_import_support.sql`
4. `supabase/migrations/202609050002_report_corrections.sql`

2本目は既存データを削除せず、顧客・現場・カゴ管理と日次再計算に必要なテーブル／列を追加します。3本目は、設置日不明の初期データを長期設置日数の計算対象外として登録できるようにします。4本目は、日報訂正時の履歴保存とコンテナ設置状況の再計算機能を追加します。

## 環境変数

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

VercelではProductionとPreviewの両方へ設定します。

## ローカル起動

```bash
npm install
npm run dev
```
