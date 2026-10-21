import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { getNativePortal } from "./lib/native/portalNative";
import { initPwa } from "./lib/pwa/register";
import { installFetchInterceptor } from "./lib/auth";
import App from "./App";
import "./index.css";

installFetchInterceptor();
initPwa();

async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    try {
      await getNativePortal();
    } catch {
      // Continue even if native plugin check errors
    }
    try {
      await StatusBar.setOverlays({ overlay: false });
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#21252e" });
    } catch {
      // StatusBar plugin might not be available in all native contexts
    }
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
