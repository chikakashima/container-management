# 現場見える化アシスト MVP

建築会社、内装施工会社、太陽光施工会社向けに、現場写真、動画、日報、進捗、危険情報をまとめて見える化するNext.jsアプリです。

## 1. 今回入っているもの

- ログイン画面
- ホーム画面
- 今日の現場一覧
- 現場管理
- 現場詳細
- 写真・動画アップロード画面
- 日報登録画面
- 要対応一覧
- 社長ダッシュボード
- ユーザー管理
- Supabase接続用の土台
- 現場登録の保存API
- 確認済み、要対応ボタンの更新API
- 将来のAI連携を見据えたテーブル設計

## 2. フォルダ構成

- `app`
  - 画面一式
- `components`
  - 再利用する表示部品
- `data/mock-data.ts`
  - Supabase未接続時の見本データ
- `lib/data.ts`
  - データ取得のまとめ
- `supabase/schema.sql`
  - テーブル作成SQL

## 3. 起動手順

1. `genba-mieruka-assist` フォルダへ移動
2. `npm install`
3. `npm run dev`
4. ブラウザで `http://localhost:3000` を開く

## 4. Supabase接続手順

`.env.local` を作って、以下を入れます。

```bash
NEXT_PUBLIC_SUPABASE_URL=あなたのSupabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=あなたのSupabase ANON KEY
```

その後、SupabaseのSQLエディタで `supabase/schema.sql` を実行します。

写真アップロードまで実保存する場合は、Supabase Storageで `site-media` バケットも作成します。

## 5. 将来のAI拡張ポイント

- `media_files.ai_status`
  - 写真判定の進行状態を入れられます
- `site_reports.report_type`
  - 手入力、音声文字起こし、AI要約を分けられます
- `site_scores`
  - AIによる工程判定や遅延予測の結果を蓄積できます

## 6. 設計の考え方

このMVPは、AIの派手さよりも、まず以下を減らすことを優先しています。

- 管理職の移動時間
- 電話確認
- LINE写真整理
- 日報整理
- 確認漏れ

## 7. 画面の見方

- 緑: 順調
- 黄: 注意
- 赤: 緊急
- 青: 確認済み
- グレー: 完了
