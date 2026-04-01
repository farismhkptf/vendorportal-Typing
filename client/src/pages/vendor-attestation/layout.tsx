import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileQuestion, Briefcase, Sun, Moon, LogOut, X, ArrowLeft } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAttestationVendorAuth } from "@/hooks/use-attestation-vendor-auth";

interface AttestationLayoutProps {
  children: ReactNode;
}

export function AttestationVendorLayout({ children }: AttestationLayoutProps) {
  const [location] = useLocation();
  const { mode, toggleMode } = useTheme();
  const { user, logout } = useAttestationVendorAuth();
  const [showProfile, setShowProfile] = useState(false);

  const tabs = [
    { path: "/", icon: LayoutDashboard, label: "Home" },
    { path: "/inquiries", icon: FileQuestion, label: "Inquiries" },
    { path: "/jobs", icon: Briefcase, label: "Jobs" },
  ];

  const currentPath = location;

  return (
    <div className="v2-portal-root" data-testid="attestation-vendor-layout">
      <div className="v2-bg-layer" />

      <div className="relative z-10 flex flex-col h-screen">
        <header className="flex items-center justify-between px-5 pt-4 pb-2 lg:px-8 lg:pt-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <span className="text-amber-700 dark:text-white font-bold text-sm">A</span>
            </div>
            <span className="text-slate-700 dark:text-white/90 font-medium text-sm hidden sm:block">
              {user?.vendorName || "Attestation Portal"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleMode}
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              data-testid="button-attest-theme-toggle"
            >
              {mode === "dark" ? (
                <Sun className="h-4 w-4 text-slate-500 dark:text-white/70" />
              ) : (
                <Moon className="h-4 w-4 text-slate-500 dark:text-white/70" />
              )}
            </button>

            <button
              onClick={() => setShowProfile(!showProfile)}
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              data-testid="button-attest-profile"
            >
              <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-white/20 flex items-center justify-center">
                <span className="text-[11px] font-bold text-amber-700 dark:text-white">{user?.name?.charAt(0) || "A"}</span>
              </div>
            </button>
          </div>
        </header>

        {showProfile && (
          <div className="absolute right-4 top-16 z-50 glass-panel rounded-2xl p-4 w-64" data-testid="attest-profile-dropdown">
            <div className="mb-3 pb-3 border-b border-slate-200 dark:border-white/10">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-slate-400 dark:text-white/50">{user?.email}</p>
            </div>
            {user?.isAdminViewing && (
              <button
                onClick={() => { window.location.href = "/"; }}
                className="w-full flex items-center gap-2 p-2 rounded-xl text-sm text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                data-testid="button-back-to-admin-attest"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </button>
            )}
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-white/10 transition-colors"
              data-testid="button-attest-logout"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 pb-24 lg:px-8 lg:pb-8">
          {children}
        </main>

        <nav className="fixed bottom-4 left-4 right-4 z-30 flex justify-center" data-testid="attest-bottom-nav">
          <div className="v2-dock flex items-center justify-center gap-1 px-3 py-2">
            {tabs.map(tab => {
              const isActive = currentPath === tab.path ||
                (tab.path !== "/" && currentPath.startsWith(tab.path));
              return (
                <Link key={tab.path} href={tab.path}>
                  <button
                    className={`v2-dock-item relative flex flex-col items-center gap-0.5 px-5 py-2 rounded-2xl transition-all ${
                      isActive
                        ? "text-amber-700 dark:text-white v2-dock-item-active"
                        : "text-slate-400 dark:text-white/50 hover:text-slate-600 dark:hover:text-white/80"
                    }`}
                    data-testid={`attest-nav-tab-${tab.label.toLowerCase()}`}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-amber-50 dark:bg-white/15 rounded-2xl" />
                    )}
                    <div className="relative">
                      <tab.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-medium relative">{tab.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
