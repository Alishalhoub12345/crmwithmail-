import { createContext, createElement, useContext, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, setToken, removeToken, getToken } from "@/lib/queryClient";
import type { ReactNode } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "owner" | "admin" | "coach" | "member" | "dietitian";
  branchId: number | null;
  status: string;
}

interface UseAuthValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginMutation: {
    isPending: boolean;
    mutateAsync: (variables: { email: string; password: string }) => Promise<any>;
  };
  resetPasswordMutation: {
    isPending: boolean;
    mutateAsync: (variables: { email: string }) => Promise<any>;
  };
  logout: () => void;
}

const AuthContext = createContext<UseAuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const hasToken = !!getToken();

  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    enabled: hasToken,
    retry: false,
  });

  useEffect(() => {
    if (!error) return;

    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("401:") || message.startsWith("404:")) {
      removeToken();
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
    }
  }, [error]);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.setQueryData(["/api/auth/me"], data.user);
    },
  });

  const logout = () => {
    removeToken();
    queryClient.clear();
    window.location.href = "/login";
  };

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", { email });
      return res.json();
    },
  });

  const value: UseAuthValue = {
    user: hasToken ? user ?? null : null,
    isLoading: hasToken && isLoading,
    loginMutation,
    resetPasswordMutation,
    logout,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function useHasRole(...roles: string[]) {
  const { user } = useAuth();
  return user ? roles.includes(user.role) : false;
}
