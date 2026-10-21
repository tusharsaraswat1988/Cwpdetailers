/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "in.cwpdetailers.customer",
  appName: "CWP Detailers",
  webDir: "../cwp-platform/dist/public",
  android: {
    backgroundColor: "#f5f6f8",
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#f5f6f8",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#00cccc",
    },
  },
  includePlugins: [
    "@capacitor/app",
    "@capacitor/geolocation",
    "@capacitor/status-bar",
    "@capacitor/splash-screen",
  ],
};

module.exports = config;
