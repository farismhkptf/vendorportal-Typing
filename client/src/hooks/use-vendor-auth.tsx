import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

type VendorUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  vendorId: string | null;
  vendorName: string | null;
  isAdminViewing?: boolean;
};

type VendorAuthContextType = {
  user: VendorUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<VendorUser>;
  logout: () => Promise<void>;
};

const VendorAuthContext = createContext<VendorAuthContextType | null>(null);

export function VendorAuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();

  const {
    data: user = null,
    isLoading,
  } = useQuery<VendorUser | null>({
    queryKey: ["/api/vendor/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/vendor/auth/me", { credentials: "include" });
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
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/vendor/auth/login", { username, password });
      return res.json() as Promise<VendorUser>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/vendor/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/vendor/auth/me"], null);
      setLocation("/vendor/login");
    },
  });

  const login = async (username: string, password: string): Promise<VendorUser> => {
    return loginMutation.mutateAsync({ username, password });
  };

  const logout = async (): Promise<void> => {
    return logoutMutation.mutateAsync();
  };

  return (
    <VendorAuthContext.Provider value={{ user: user ?? null, isLoading, login, logout }}>
      {children}
    </VendorAuthContext.Provider>
  );
}

export function useVendorAuth(): VendorAuthContextType {
  const context = useContext(VendorAuthContext);
  if (!context) {
    throw new Error("useVendorAuth must be used within a VendorAuthProvider");
  }
  return context;
}
