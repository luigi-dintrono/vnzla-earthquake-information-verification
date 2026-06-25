import { config } from "dotenv";

// Load .env.local first (Next's convention), then .env as a fallback.
config({ path: ".env.local", quiet: true });
config({ quiet: true });
