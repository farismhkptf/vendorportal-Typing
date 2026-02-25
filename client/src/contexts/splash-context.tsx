import { createContext, useContext, useState } from "react";

interface SplashContextType {
  splashActive: boolean;
  setSplashActive: (v: boolean) => void;
}

const SplashContext = createContext<SplashContextType>({
  splashActive: true,
  setSplashActive: (_: boolean) => {},
});

export function SplashProvider({ children }: { children: React.ReactNode }) {
  const [splashActive, setSplashActive] = useState(() => {
    if (sessionStorage.getItem("splashShown")) return false;
    return true;
  });

  return (
    <SplashContext.Provider value={{ splashActive, setSplashActive }}>
      {children}
    </SplashContext.Provider>
  );
}

export function useSplash() {
  return useContext(SplashContext);
}
