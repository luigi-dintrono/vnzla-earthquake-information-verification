import "./load-env";
import { runIngest } from "@/lib/ingest";

runIngest()
  .then((summary) => {
    console.log("[ingest]", summary);
    process.exit(0);
  })
  .catch((e) => {
    console.error("[ingest] failed:", e.message);
    process.exit(1);
  });
