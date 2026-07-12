/**
 * 既存の actress-image-overrides.json を DB相当スキーマへ正規化して書き戻す。
 * （本番は GitHub 上の同ファイルが正。ローカル実行用）
 *
 * Usage: node scripts/migrate-actress-image-overrides.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const filePath = path.join(
  process.cwd(),
  "data/dmm/actress-image-overrides.json",
);

function migrate(raw) {
  const overrides = Array.isArray(raw.overrides) ? raw.overrides : [];
  const now = new Date().toISOString();
  const next = overrides
    .map((row) => {
      const actressId = row.actress_id || row.key;
      if (!actressId) return null;
      const imageUrl = row.image_url ?? row.imageUrl ?? null;
      const workId = row.work_id ?? row.workId ?? null;
      const selectionType =
        row.selection_type === "automatic" || row.note === "automatic"
          ? "automatic"
          : "manual";
      return {
        id: row.id || `override_${actressId}`,
        actress_id: actressId,
        key: actressId,
        work_id: workId,
        image_url: imageUrl,
        selection_type: selectionType,
        selected_by: row.selected_by ?? "admin",
        selected_at: row.selected_at || row.updatedAt || now,
        updated_at: row.updated_at || row.updatedAt || now,
        note: row.note ?? null,
        useDefault: Boolean(row.useDefault),
        score: row.score,
        faceDetected: row.faceDetected,
        isSoloWork: row.isSoloWork,
        imageUrl: imageUrl ?? undefined,
        workId,
      };
    })
    .filter(Boolean);

  // actress_id unique
  const byId = new Map();
  for (const row of next) {
    byId.set(row.actress_id, row);
  }

  return {
    version: 2,
    updatedAt: now,
    overrides: [...byId.values()],
  };
}

if (!existsSync(filePath)) {
  console.log("overrides file not found, creating empty schema");
  writeFileSync(
    filePath,
    `${JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), overrides: [] }, null, 2)}\n`,
  );
  process.exit(0);
}

const raw = JSON.parse(readFileSync(filePath, "utf-8"));
const migrated = migrate(raw);
writeFileSync(filePath, `${JSON.stringify(migrated, null, 2)}\n`);
console.log(`migrated ${migrated.overrides.length} overrides -> ${filePath}`);
