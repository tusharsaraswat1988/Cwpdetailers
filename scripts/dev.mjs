import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile, findEnvFile } from "../lib/env/load-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const baseEnv = { ...process.env };
loadEnvFile(findEnvFile(root), { override: process.env.NODE_ENV !== "production" });
Object.assign(baseEnv, process.env);
baseEnv.NODE_ENV = "development";

function listeningPids(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr ":${port}.*LISTENING"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().match(/\s(\d+)\s*$/);
        if (m && m[1] !== "0") pids.add(m[1]);
      }
      return [...pids];
    }
    const out = execSync(`lsof -ti:${port} || true`, {
      encoding: "utf8",
      shell: true,
      stdio: ["pipe", "pipe", "ignore"],
    });
    return out.split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

/** Stop stale listeners so `pnpm dev` can restart after Ctrl+C left orphans (common on Windows). */
function freePort(port) {
  for (const pid of listeningPids(port)) {
    console.log(`Stopping previous process on port ${port} (PID ${pid})…`);
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      }
    } catch {
      // Access denied (Windows service) or process already gone
    }
  }
  return listeningPids(port).length === 0;
}

function pickApiPort() {
  const preferred = Number(process.env.API_PORT || 8080);
  const fallback = preferred === 8081 ? 8082 : 8081;
  if (freePort(preferred)) return String(preferred);
  if (freePort(fallback)) {
    console.warn(
      `Port ${preferred} is in use and could not be freed (often a Windows service such as PEMHTTPD). Using ${fallback} for the API.`,
    );
    return String(fallback);
  }
  console.error(`Could not bind API on port ${preferred} or ${fallback}.`);
  process.exit(1);
}

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
execSync("pnpm --filter @workspace/scripts exec tsx src/ensure-master-data.ts", {
  cwd: root,
  env: baseEnv,
  stdio: "inherit",
  shell: true,
});

const apiPort = pickApiPort();

execSync("pnpm --filter @workspace/api-server run build", {
  cwd: root,
  env: { ...baseEnv, PORT: apiPort },
  stdio: "inherit",
  shell: true,
});

console.log(`Starting API (http://127.0.0.1:${apiPort}) + frontend (http://127.0.0.1:21456) ...`);

freePort(21456);

children.push(
  run("api", "pnpm", ["--filter", "@workspace/api-server", "run", "start"], {
    PORT: apiPort,
  }, "36"),
  run("web", "pnpm", ["--filter", "@workspace/cwp-platform", "run", "dev"], {
    PORT: "21456",
    API_PORT: apiPort,
    BASE_PATH: "/",
  }, "32"),
);
