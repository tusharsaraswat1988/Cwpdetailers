import { loadRepoEnv } from "../../lib/env/load-env.mjs";

export function loadEnv() {
  loadRepoEnv(import.meta.url);
}

loadEnv();
