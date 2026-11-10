import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ACTIVE_STORE_STORAGE_KEY, apiClient, AUTH_TOKEN_STORAGE_KEY, BILL_DRAFT_STORAGE_KEY, extractErrorMessage } from "@/lib/apiClient";
import type { AuthUser, StoreSummary } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isSuperAdmin: boolean;
  /** Super admin only: switch the store the app acts in (reloads the app). */
  switchStore: (storeId: string) => void;
  /** Super admin Add SKU: align X-Store-Id with the destination without reloading. */
  setActingStore: (store: StoreSummary) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) {
      setIsLoading(false);
      return;
    }
    apiClient
      .get<AuthUser>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY))
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isSuperAdmin: user?.role === "SUPER_ADMIN",
      switchStore: (storeId: string) => {
        localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, storeId);
        window.location.reload();
      },
      setActingStore: (store: StoreSummary) => {
        localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, store.id);
        setUser((prev) => (prev ? { ...prev, store } : prev));
      },
      login: async (email: string, password: string) => {
        try {
          const res = await apiClient.post<{ token: string; user: AuthUser }>("/auth/login", { email, password });
          localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.data.token);
          localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, res.data.user.store.id);
          setUser(res.data.user);
        } catch (error) {
          throw new Error(extractErrorMessage(error, "Invalid email or password"));
        }
      },
      logout: () => {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
        localStorage.removeItem(BILL_DRAFT_STORAGE_KEY);
        queryClient.clear();
        setUser(null);
      },
    }),
    [user, isLoading, queryClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
