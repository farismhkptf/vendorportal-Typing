import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import proLogo from "@assets/Our_Logo_1771503275390.png";
import { CompanyName } from "@/components/ui/company-name";

const PHASES = ["logo", "glow", "text", "tagline", "ready", "exit"] as const;
type Phase = (typeof PHASES)[number];

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>("logo");
  const completedRef = useRef(false);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    sessionStorage.setItem("splashShown", "1");
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("glow"),    500);
    const t2 = setTimeout(() => setPhase("text"),    900);
    const t3 = setTimeout(() => setPhase("tagline"), 1500);
    const t4 = setTimeout(() => setPhase("ready"),   2100);
    const t5 = setTimeout(() => setPhase("exit"),    2500);
    const t6 = setTimeout(finish,                    3500);
    return () => { [t1, t2, t3, t4, t5, t6].forEach(clearTimeout); };
  }, [finish]);

  const isExiting   = phase === "exit";
  const showText    = !["logo", "glow"].includes(phase) && !isExiting;
  const showTagline = ["tagline", "ready"].includes(phase) && !isExiting;
  const showBar     = phase === "ready" && !isExiting;

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0">
        <div className="login-bg-gradient" aria-hidden="true" />
        <div className="login-bg-grain" aria-hidden="true" />
        <div className="login-bg-overlay" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0, opacity: 0, rotate: -90 }}
          animate={{
            scale: phase === "glow" ? 1.08 : 1,
            opacity: isExiting ? 0 : 1,
            rotate: 0,
          }}
          transition={{
            scale: { type: "spring", stiffness: 120, damping: 12 },
            opacity: { duration: 0.4 },
            rotate: { duration: 0.6 },
          }}
        >
          <div style={{
            width: "5.5rem",
            height: "5.5rem",
            backgroundColor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <img
              src={proLogo}
              alt="The P.R.O. Company"
              style={{ width: "3rem", height: "3rem", objectFit: "contain" }}
            />
          </div>
        </motion.div>

        <div style={{
          marginTop: "1.5rem",
          minHeight: "4rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <motion.span
            style={{ color: "#ffffff", fontWeight: 700, fontSize: "1.5rem" }}
            animate={{ opacity: showText ? 1 : 0, scale: showText ? 1 : 0.85 }}
            transition={{ duration: 0.3 }}
          >
            <CompanyName />
          </motion.span>

          <motion.span
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.7rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              marginTop: "0.5rem",
            }}
            animate={{ opacity: showTagline ? 1 : 0, y: showTagline ? 0 : 6 }}
            transition={{ duration: 0.3 }}
          >
            Internal Portal
          </motion.span>

          <motion.div
            style={{
              marginTop: "1.25rem",
              width: "3rem",
              height: "2px",
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: "999px",
              overflow: "hidden",
            }}
            animate={{ opacity: showBar ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              style={{
                height: "100%",
                backgroundColor: "#20467a",
                borderRadius: "999px",
              }}
              animate={{ width: showBar ? "100%" : "0%" }}
              transition={{ duration: 0.6 }}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
