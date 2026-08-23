const fs = require("fs");
const path = require("path");

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

function staffServerUrl(raw) {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/staff/login";
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const remoteUrl = staffServerUrl(readEnvValue("STAFF_APP_SERVER_URL"));

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "in.cwpdetailers.staff",
  appName: "CWP Staff",
  webDir: "../cwp-platform/dist/public",
  android: {
    allowMixedContent: true,
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
