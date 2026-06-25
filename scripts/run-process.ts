import "./load-env";
import { processPending } from "@/lib/process";

const limit = Number(process.argv[2] ?? "100");

processPending(Number.isFinite(limit) ? limit : 100)
  .then((summary) => {
    console.log("[process]", summary);
    process.exit(0);
  })
  .catch((e) => {
    console.error("[process] failed:", e.message);
    process.exit(1);
  });
