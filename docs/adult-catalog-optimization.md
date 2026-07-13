# アダルト図鑑カタログ軽量化メモ

## Phase 1 監査結果（重要度順）

1. 公開ISRミスごとに全25シャード（旧約70MB）を読込・parse
2. fanza-sync / refresh / popular-batch がバッチごとに全シャード書き換え
3. タイムスタンプだけの差分で毎回「更新」扱いだった
4. sampleImageURL / sampleMovieURL が肥大化の主因（rawApiResponseは無し）
5. 検索は force-dynamic、作品詳細は既に revalidate=604800

## 分離後

| | サイズ |
|---|---|
| 表示用 catalog/*.json | 約 25.9 MB |
| media catalog-media/*.json | 約 26.3 MB（256シャード） |
| 作品数 | 12,500（変更なし） |

バックアップ例: `data/backups/adult-catalog-before-raw-split-*`

## 同期

- `light`: prices / sale* / review / campaign / sourcePopularityRank
- `full`: 従来どおりの再取得マージ（実データ差分があるときだけ保存）
- 変更なしバッチ: カタログGitHubコミットをスキップ（ジョブ状態のみ）
- 変更あり: 差分シャードのみ commit

## 書き込み

- ローカル: `ADULT_LOCAL_WRITE_ENABLED=true` かつ非Vercel
- 本番: GitHub Data API 正規保存を維持

## コマンド

```bash
npm run adult:raw:dry-run
ADULT_LOCAL_WRITE_ENABLED=true npm run adult:raw:split
npm run adult:raw:verify
npm run test:adult-sync-guard
```
