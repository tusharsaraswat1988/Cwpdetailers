import "./load-env.js";

/** CLI entry — run via: pnpm --filter @workspace/api-server exec tsx src/lib/address/migration/run-legacy-migration.ts */
await import("../../../../../artifacts/api-server/src/lib/address/migration/run-legacy-migration.ts");
