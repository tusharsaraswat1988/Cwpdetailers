import { createRoot } from "react-dom/client";
import { initPwa } from "./lib/pwa/register";
import App from "./App";
import "./index.css";

initPwa();

createRoot(document.getElementById("root")!).render(<App />);
