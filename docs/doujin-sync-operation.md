# 同人図鑑 FANZA 同期運用手順

## 軽量同期と完全同期の違い

| | 軽量同期 (`light`) | 完全同期 (`full`) |
|---|---|---|
| 目的 | 日常の価格・評価・順位更新 | 説明・画像・関連エンティティ含む全更新 |
| 更新項目 | price / originalPrice / discountRate / isSale / saleEndAt / rating / reviewCount / currentPopularRank / lastFetchedAt | タイトル・説明・画像・サンプル・サークル・作者・シリーズ・ジャンル・形式・価格・raw など全正規化項目 |
| raw | 更新しない | 変更作品のシャードのみ更新 |
| 推奨頻度 | 1日1回 | 週1回・手動・調査時のみ |
| 負荷 | 低 | 高 |

## 環境変数

すべて **未設定時は無効**（`=== "true"` のときだけ有効）。

```bash
PERFORMANCE_DEBUG=false

# ローカルJSON書き込みを明示的に許可
DOUJIN_LOCAL_WRITE_ENABLED=false

# 価格・割引・評価・ランキングのみを更新
DOUJIN_LIGHT_SYNC_ENABLED=false

# 全商品情報を更新。高負荷のため通常はfalse
DOUJIN_FULL_SYNC_ENABLED=false

DOUJIN_LIGHT_SYNC_BATCH_SIZE=500
DOUJIN_FULL_SYNC_BATCH_SIZE=100
```

ローカルで実行するときだけ `DOUJIN_LOCAL_WRITE_ENABLED=true` と該当同期フラグを `true` にします。

**本番 Vercel** では `VERCEL` 判定により、上記が true でも JSON 書き込み API は常に 403 です。

## ローカル実行

### dry-run

```bash
DOUJIN_LOCAL_WRITE_ENABLED=true npm run doujin:sync:light:dry-run -- --limit=100
DOUJIN_FULL_SYNC_ENABLED=true DOUJIN_LOCAL_WRITE_ENABLED=true npm run doujin:sync:full:dry-run -- --limit=50
```

dry-run ではファイルを書き換えず、API取得・新規/更新/変更なし/スキップ/エラー・変更対象フィールド・推定JSON保存回数を表示します。

### 本実行

```bash
DOUJIN_LOCAL_WRITE_ENABLED=true npm run doujin:sync:light -- --limit=500
DOUJIN_FULL_SYNC_ENABLED=true DOUJIN_LOCAL_WRITE_ENABLED=true npm run doujin:sync:full -- --limit=100
```

### 検証

```bash
npm run doujin:verify
```

## Git への反映

1. ローカルで同期を実行
2. `npm run doujin:verify`
3. `data/doujin/works.json` と `data/doujin/works-raw/` の差分を確認
4. コミット
5. GitHub へ push
6. Vercel デプロイ後に公開ページを確認

## バックアップと復元

- バックアップ例: `data/backups/doujin-works-YYYYMMDD-HHmmss.json`
- 壊した場合はバックアップを `data/doujin/works.json` へ戻し、必要なら raw 分離を再実行

## 同時実行

- 同期ジョブは同時に1つだけ
- 管理画面で重複開始しない

## Vercel で確認する場所

- Usage: Fluid Active CPU / Function Duration / Invocations
- 同人管理画面: 更新ボタンが disabled、運用手順が表示されること
- 公開 `/doujin/*`: 表示が壊れていないこと

## 注意

- `PERFORMANCE_DEBUG` は通常 `false`
- Vercel cron から同人 JSON 同期は実行しない（書き込み不可）
- アダルト図鑑の FANZA 同期 cron（`/api/cron/fanza-sync`）とは別系統
