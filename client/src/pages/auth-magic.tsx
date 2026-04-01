import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, XCircle, CheckCircle2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import proLogo from "@assets/Our_Logo_transparent.png";
import dubaiSkyline from "@assets/stock_images/dubai-skyline-login-bg.jpg";
import { CompanyName } from "@/components/ui/company-name";

type VerifyState = "verifying" | "success" | "error";

function getRedirectForRole(role: string): string {
  switch (role) {
    case "Admin":
      return "/";
    case "Client Relationship Manager":
      return "/crm";
    case "PRO":
    case "PRO - Temporary":
      return "/medical";
    default:
      return "/";
  }
}

export default function AuthMagic() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<VerifyState>("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setState("error");
      setErrorMessage("No login token found in the URL. Please request a new login link.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/auth/magic-link/verify?token=${encodeURIComponent(token!)}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setState("error");
          setErrorMessage(data.message || "Invalid or expired login link.");
          return;
        }
        const user = await res.json();
        queryClient.setQueryData(["/api/auth/me"], {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          staffId: user.staffId,
        });
        setState("success");
        setTimeout(() => {
          if (!user.profileCompleted) {
            setLocation("/profile/complete");
          } else {
            setLocation(getRedirectForRole(user.role));
          }
        }, 800);
      } catch {
        setState("error");
        setErrorMessage("Something went wrong. Please try again.");
      }
    }

    verify();
  }, [setLocation]);

  return (
    <div className="login-fullscreen">
      <img src={dubaiSkyline} alt="" className="login-bg-photo" aria-hidden="true" />
      <div className="login-bg-grain" aria-hidden="true" />
      <div className="login-bg-overlay" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-8">
        <div className="w-full max-w-[400px]">
          <div className="login-glass-card-v2 rounded-2xl overflow-hidden" data-testid="magic-link-verify-card">
            <div className="px-8 pt-10 pb-8 flex flex-col items-center text-center">
              <img
                src={proLogo}
                alt="The P.R.O. Company"
                className="h-14 w-14 rounded-2xl object-contain opacity-90 mb-5 shadow-lg"
                data-testid="img-pro-logo"
              />
              <h1 className="text-[22px] font-bold tracking-tight text-white mb-1.5">
                <CompanyName />
              </h1>

              {state === "verifying" && (
                <div className="mt-8 space-y-4" data-testid="status-verifying">
                  <Loader2 className="h-10 w-10 animate-spin text-white/60 mx-auto" />
                  <p className="text-white/70 text-sm">Verifying your login link…</p>
                </div>
              )}

              {state === "success" && (
                <div className="mt-8 space-y-4" data-testid="status-success">
                  <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto" />
                  <p className="text-white font-medium">Signed in successfully!</p>
                  <p className="text-white/60 text-sm">Redirecting you now…</p>
                </div>
              )}

              {state === "error" && (
                <div className="mt-8 space-y-4" data-testid="status-error">
                  <XCircle className="h-10 w-10 text-red-400 mx-auto" />
                  <p className="text-white font-medium">Login link invalid</p>
                  <p className="text-white/60 text-sm">{errorMessage}</p>
                  <button
                    onClick={() => setLocation("/login")}
                    className="login-brand-button px-6 py-2.5 rounded-md text-sm mt-2"
                    data-testid="button-back-to-login"
                  >
                    Back to login
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
