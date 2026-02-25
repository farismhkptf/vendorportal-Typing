import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SplashProvider } from "@/contexts/splash-context";

createRoot(document.getElementById("root")!).render(
  <SplashProvider>
    <App />
  </SplashProvider>
);
