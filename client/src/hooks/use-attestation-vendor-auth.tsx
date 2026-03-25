import { createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AttestationVendorUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  vendorId: string | null;
  vendorName: string | null;
  vendorType: string | null;
  isAdminViewing?: boolean;
};

type AttestationVendorAuthContextType = {
  user: AttestationVendorUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};

const AttestationVendorAuthContext = createContext<AttestationVendorAuthContextType | null>(null);

export function AttestationVendorAuthProvider({ children }: { children: ReactNode }) {
  const {
    data: user = null,
    isLoading,
  } = useQuery<AttestationVendorUser | null>({
    queryKey: ["/api/attestation-vendor/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/attestation-vendor/auth/me", { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
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

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/attestation-vendor/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/attestation-vendor/auth/me"], null);
      window.location.href = "/vendor-attestation/login";
    },
  });

  const logout = async (): Promise<void> => {
    return logoutMutation.mutateAsync();
  };

  return (
    <AttestationVendorAuthContext.Provider value={{ user: user ?? null, isLoading, logout }}>
      {children}
    </AttestationVendorAuthContext.Provider>
  );
}

export function useAttestationVendorAuth(): AttestationVendorAuthContextType {
  const context = useContext(AttestationVendorAuthContext);
  if (!context) {
    throw new Error("useAttestationVendorAuth must be used within an AttestationVendorAuthProvider");
  }
  return context;
}
