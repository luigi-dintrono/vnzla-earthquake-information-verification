import "./load-env";
import { runIngest } from "@/lib/ingest";

// Optional time window: `npm run ingest -- 12` crawls only the last 12 hours.
const arg = process.argv[2] ? Number(process.argv[2]) : undefined;
const sinceHours = Number.isFinite(arg) ? arg : undefined;

runIngest({ sinceHours })
  .then((summary) => {
    console.log("[ingest]", summary);
    process.exit(0);
  })
  .catch((e) => {
    console.error("[ingest] failed:", e.message);
    process.exit(1);
  });
