import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { getNativePortal } from "./lib/native/portalNative";
import { initPwa } from "./lib/pwa/register";
import App from "./App";
import "./index.css";

initPwa();

async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    try {
      await getNativePortal();
    } catch {
      // Continue even if native plugin check errors
    }
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
