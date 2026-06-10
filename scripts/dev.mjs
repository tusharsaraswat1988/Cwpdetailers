import { spawn, execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const env = { ...process.env };
  if (!existsSync(file)) return env;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const baseEnv = loadEnv(path.join(root, ".env"));
baseEnv.NODE_ENV = "development";

function prefixStream(name, color, stream) {
  stream.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) console.log(`\x1b[${color}m[${name}]\x1b[0m ${line}`);
    }
  });
}

function run(name, command, args, extraEnv, color) {
  const child = spawn(command, args, {
    cwd: root,
    env: { ...baseEnv, ...extraEnv },
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
  });
  prefixStream(name, color, child.stdout);
  prefixStream(name, color, child.stderr);
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

const children = [];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("Building API server...");
execSync("pnpm --filter @workspace/api-server run build", {
  cwd: root,
  env: { ...baseEnv, PORT: "8080" },
  stdio: "inherit",
  shell: true,
});

console.log("Starting API (http://127.0.0.1:8080) + frontend (http://127.0.0.1:21456) ...");

children.push(
  run("api", "pnpm", ["--filter", "@workspace/api-server", "run", "start"], {
    PORT: "8080",
  }, "36"),
  run("web", "pnpm", ["--filter", "@workspace/cwp-platform", "run", "dev"], {
    PORT: "21456",
    BASE_PATH: "/",
  }, "32"),
);
