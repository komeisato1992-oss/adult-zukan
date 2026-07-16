import { existsSync, readFileSync } from "fs";
import {
  getLiveStatusInitStatus,
  processLiveStatusInitBatch,
  startLiveStatusInitJob,
} from "../lib/admin/live-status-init-runner";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    if (trimmed.startsWith("{")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const started = Date.now();
  const { job: startedJob } = await startLiveStatusInitJob();
  console.log("[live-init] started", {
    status: startedJob.status,
    missingAtStart: startedJob.missingAtStart,
  });

  let job = startedJob;
  let loops = 0;
  while (
    job.status === "running" ||
    job.status === "pending" ||
    job.status === "waiting"
  ) {
    if (job.status === "waiting" && job.waitUntil) {
      const waitMs = Date.parse(job.waitUntil) - Date.now();
      if (waitMs > 0) {
        console.log(`[live-init] 429 wait ${Math.ceil(waitMs / 1000)}s`);
        await new Promise((resolve) => setTimeout(resolve, waitMs + 50));
      }
    }

    const result = await processLiveStatusInitBatch();
    job = result.job;
    loops += 1;
    if (loops % 20 === 0 || result.done) {
      console.log("[live-init] progress", {
        inserted: job.insertedCount,
        remaining: job.remainingCount,
        failed: job.failedCount,
        live: job.liveStatusCount,
        works: job.worksCount,
        status: job.status,
      });
    }
    if (result.done) break;
  }

  const finalStatus = await getLiveStatusInitStatus();
  console.log(
    JSON.stringify(
      {
        insertedCount: job.insertedCount,
        failedCount: job.failedCount,
        elapsedMs: Date.now() - started,
        finalLiveStatusCount: finalStatus.liveStatusCount,
        finalWorksCount: finalStatus.worksCount,
        missingCount: finalStatus.missingCount,
        initRatePercent: finalStatus.initRatePercent,
        status: job.status,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
