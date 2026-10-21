const fs = require("fs");
const path = require("path");
const os = require("os");

const repoRoot = path.resolve(__dirname, "../..");
const envPath = path.join(repoRoot, ".env");

function readEnvValue(key) {
  if (process.env[key] && process.env[key].trim()) return process.env[key].trim();
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((row) => row.startsWith(`${key}=`));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "") || undefined;
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
  return undefined;
}

function staffServerUrl(raw) {
  if (!raw) return undefined;
  let formatted = raw.trim();
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = `http://${formatted}`;
  }
  try {
    const url = new URL(formatted);
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/staff/login";
    }
    return url.toString();
  } catch {
    return formatted;
  }
}

// In standard bundled mode, no server.url is used so assets load from local device storage.
// Live-reload over Wi-Fi / ADB is enabled only when CAP_LIVE_RELOAD=true.
const isLiveReload = process.env.CAP_LIVE_RELOAD === "true";
let remoteUrl = undefined;

if (isLiveReload) {
  const configuredUrl = readEnvValue("STAFF_APP_SERVER_URL");
  if (configuredUrl) {
    remoteUrl = staffServerUrl(configuredUrl);
  } else {
    const autoIp = getLanIpAddress();
    if (autoIp) {
      remoteUrl = staffServerUrl(`http://${autoIp}:21456`);
      console.log(`[Capacitor Live Reload] Auto-detected reachable LAN IP: ${autoIp}`);
    }
  }

  if (remoteUrl) {
    console.log(`[Capacitor Live Reload] ACTIVE -> Staff WebView target: ${remoteUrl}`);
  } else {
    console.warn(
      `[Capacitor Live Reload] WARNING: CAP_LIVE_RELOAD=true was passed, but no server URL or LAN IP could be detected. Falling back to bundled assets.`,
    );
  }
}

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "in.cwpdetailers.staff",
  appName: "CWP Staff",
  webDir: "../cwp-platform/dist/public",
  android: {
    backgroundColor: "#21252e",
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#21252e",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#21252e",
    },
    Camera: {
      saveToGallery: false,
    },
  },
  includePlugins: [
    "@capacitor/app",
    "@capacitor/camera",
    "@capacitor/geolocation",
    "@capacitor/status-bar",
    "@capacitor/splash-screen",
  ],
};

if (remoteUrl) {
  config.server = {
    url: remoteUrl,
    cleartext: remoteUrl.startsWith("http://"),
    androidScheme: remoteUrl.startsWith("https://") ? "https" : "http",
  };
}

module.exports = config;
