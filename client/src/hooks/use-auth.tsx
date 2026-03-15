import { createContext, useContext, useEffect, useRef, ReactNode, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  staffId: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  quickLogin: (userId: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();

  const {
    data: user = null,
    isLoading,
  } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        return null;
      }
      if (!res.ok) {
        return null;
      }
      return res.json();
    },
    staleTime: Infinity,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const quickLoginMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", "/api/auth/quick-login", { userId });
      return res.json() as Promise<AuthUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.removeQueries({ queryKey: ["/api/auth/login-history"] });
      setLocation("/login");
    },
  });

  const login = async (email: string, password: string): Promise<AuthUser> => {
    return loginMutation.mutateAsync({ email, password });
  };

  const quickLogin = async (userId: string): Promise<AuthUser> => {
    return quickLoginMutation.mutateAsync(userId);
  };

  const [sessionExpired, setSessionExpired] = useState(false);
  const wasAuthed = useRef(false);
  const intentionalLogout = useRef(false);

  const logout = async (): Promise<void> => {
    intentionalLogout.current = true;
    return logoutMutation.mutateAsync();
  };

  useEffect(() => {
    if (user) {
      wasAuthed.current = true;
      intentionalLogout.current = false;
      setSessionExpired(false);
    } else if (wasAuthed.current && !isLoading && !intentionalLogout.current) {
      setSessionExpired(true);
    }
  }, [user, isLoading]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) {
          queryClient.setQueryData(["/api/auth/me"], null);
        }
      } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, quickLogin, logout }}>
      {sessionExpired && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Session Expired</h2>
            <p className="text-sm text-muted-foreground">Your session has expired. Please log in again to continue.</p>
            <button
              className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
              onClick={() => { setSessionExpired(false); setLocation("/login"); }}
              data-testid="button-session-expired-login"
            >
              Log In Again
            </button>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
