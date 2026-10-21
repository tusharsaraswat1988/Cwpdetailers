import { spawnSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { processCssDirectory } from "./unwrap-css-layers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appTarget = process.argv[2] && !process.argv[2].startsWith("-") ? process.argv[2] : "staff";
const isBundled = process.argv.includes("--bundled") || process.argv.includes("--offline");
const isAdbReverse = process.argv.includes("--adb-reverse");
const shouldInstall = process.argv.includes("--install");
const urlArgIdx = process.argv.indexOf("--url");
const customUrl = urlArgIdx !== -1 ? process.argv[urlArgIdx + 1] : undefined;

const appDir = path.join(root, "artifacts", `cwp-${appTarget}-app`);
if (!fs.existsSync(appDir)) {
  console.error(`\x1b[31m[Error]\x1b[0m App directory not found: ${appDir}`);
  process.exit(1);
}

function getLanIpAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

function findAdbExecutable() {
  try {
    const check = execSync("where.exe adb", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
    if (check) return check.split(/\r?\n/)[0];
  } catch {
    // ignore
  }

  const localAppData = process.env.LOCALAPPDATA || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "AppData", "Local") : "");
  if (localAppData) {
    const defaultAdb = path.join(localAppData, "Android", "Sdk", "platform-tools", "adb.exe");
    if (fs.existsSync(defaultAdb)) return defaultAdb;
  }
  return undefined;
}

function findJdk21Home() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }
  const candidates = [
    "C:\\Program Files\\Microsoft\\jdk-21.0.12.101-hotspot",
    "C:\\Program Files\\Java\\jdk-21",
    "C:\\Program Files\\Eclipse Adoptium\\jdk-21",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

function checkDevServer(port = 21456) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 1500 }, (res) => {
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log(`\n\x1b[1m\x1b[36m============================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m   CWP Detailers — Android Live Reload Workflow Manager     \x1b[0m`);
  console.log(`\x1b[1m\x1b[36m============================================================\x1b[0m\n`);

  if (isBundled) {
    console.log(`\x1b[33mMode:\x1b[0m RESTORE BUNDLED ASSETS (offline/production mode)`);
    console.log(`Clearing CAP_LIVE_RELOAD and syncing bundled webDir...`);
    processCssDirectory(path.join(root, "artifacts", "cwp-platform", "dist", "public", "assets"));
    
    const syncRes = spawnSync("npx", ["cap", "sync", "android"], {
      cwd: appDir,
      env: { ...process.env, CAP_LIVE_RELOAD: "false" },
      stdio: "inherit",
      shell: true,
    });

    if (syncRes.status === 0) {
      processCssDirectory(path.join(appDir, "android", "app", "src", "main", "assets", "public"));
      console.log(`\n\x1b[32m✔ Bundled configuration successfully synced to Android project!\x1b[0m`);
      console.log(`Assets load from local APK package (no dev server needed).\n`);
    } else {
      console.error(`\x1b[31mSync failed with code ${syncRes.status}\x1b[0m`);
    }
    return;
  }

  // Live Reload Setup
  console.log(`\x1b[32mMode:\x1b[0m LIVE RELOAD (website-like rapid development)`);

  const serverRunning = await checkDevServer(21456);
  if (!serverRunning) {
    console.warn(`\x1b[33m[Notice]\x1b[0m Dev server on port 21456 is not currently responding.`);
    console.warn(`         Make sure to run \x1b[1mpnpm dev\x1b[0m in another terminal.\n`);
  } else {
    console.log(`\x1b[32m✔ Frontend dev server is active on port 21456.\x1b[0m`);
  }

  const lanIp = getLanIpAddress();
  let targetUrl = customUrl;

  const adbPath = findAdbExecutable();
  let attachedDevices = [];

  if (adbPath) {
    try {
      const out = execSync(`"${adbPath}" devices`, { encoding: "utf8" });
      const lines = out.split(/\r?\n/).slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && parts[1] === "device") {
          attachedDevices.push(parts[0]);
        }
      }
    } catch {
      // ignore
    }
  }

  if (isAdbReverse) {
    if (attachedDevices.length === 0) {
      console.warn(`\x1b[33m[Warning]\x1b[0m --adb-reverse requested, but no USB device was detected by adb.`);
      console.warn(`          Ensure USB debugging is enabled and 'adb devices' shows your phone.`);
    } else if (adbPath) {
      console.log(`\x1b[34mSetting up ADB reverse port forwarding for device: ${attachedDevices[0]}...\x1b[0m`);
      execSync(`"${adbPath}" reverse tcp:21456 tcp:21456`, { stdio: "inherit" });
      console.log(`\x1b[32m✔ Reversed port 21456 (phone http://localhost:21456 -> PC :21456)\x1b[0m`);
    }
    targetUrl = targetUrl || "http://localhost:21456";
  } else {
    targetUrl = targetUrl || `http://${lanIp}:21456`;
  }

  console.log(`\n\x1b[1mLive Reload Target:\x1b[0m \x1b[36m${targetUrl}/staff/login\x1b[0m`);
  console.log(`Syncing Capacitor android configuration with CAP_LIVE_RELOAD=true...`);

  const liveEnv = {
    ...process.env,
    CAP_LIVE_RELOAD: "true",
    STAFF_APP_SERVER_URL: targetUrl,
  };

  const syncRes = spawnSync("npx", ["cap", "sync", "android"], {
    cwd: appDir,
    env: liveEnv,
    stdio: "inherit",
    shell: true,
  });

  if (syncRes.status !== 0) {
    console.error(`\x1b[31mCapacitor sync failed with code ${syncRes.status}\x1b[0m`);
    process.exit(syncRes.status || 1);
  }

  console.log(`\n\x1b[32m✔ Live Reload configured successfully!\x1b[0m`);

  if (shouldInstall) {
    if (attachedDevices.length === 0) {
      console.warn(`\n\x1b[33mCannot install: No connected device found via adb.\x1b[0m`);
      console.warn(`Connect your phone with USB debugging enabled, then re-run with --install.`);
    } else {
      console.log(`\n\x1b[34mInstalling debug APK to device (${attachedDevices[0]})...\x1b[0m`);
      const jdkHome = findJdk21Home();
      const gradleEnv = { ...liveEnv };
      if (jdkHome) {
        gradleEnv.JAVA_HOME = jdkHome;
        console.log(`Using JDK: ${jdkHome}`);
      }

      const gradlewCmd = process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew";
      const installRes = spawnSync(gradlewCmd, ["installDebug"], {
        cwd: path.join(appDir, "android"),
        env: gradleEnv,
        stdio: "inherit",
        shell: true,
      });

      if (installRes.status === 0) {
        console.log(`\n\x1b[32m✔ Debug APK installed successfully to phone!\x1b[0m`);
        console.log(`Launch the "CWP Staff" app on your phone now.`);
      } else {
        console.error(`\x1b[31mAPK install failed. You can build/install via Android Studio.\x1b[0m`);
      }
    }
  }

  console.log(`
\x1b[1mNext Steps:\x1b[0m
1. Keep \x1b[33mpnpm dev\x1b[0m running in your terminal.
2. Ensure your Android phone is on the same Wi-Fi network (\x1b[36m${lanIp}\x1b[0m) OR connected via USB with \x1b[36madb reverse tcp:21456 tcp:21456\x1b[0m.
3. Open \x1b[1mCWP Staff\x1b[0m on your phone.
4. Modify any React/UI code in \x1b[35martifacts/cwp-platform/src\x1b[0m — changes will appear instantly on the phone without rebuilding!
5. To revert back to standalone offline APK: run \x1b[32mpnpm run android:staff:bundled\x1b[0m
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
