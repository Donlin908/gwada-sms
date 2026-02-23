import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AuthUser {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
}

interface RegisterResult {
  requiresVerification?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  resendVerification: () => Promise<void>;
  loginError: string | null;
  registerError: string | null;
  isLoginPending: boolean;
  isRegisterPending: boolean;
  isResendPending: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery<{ user: AuthUser } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (res.status === 401) return null;
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ username, email, password }: { username: string; email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/register", { username, email, password });
      return res.json() as Promise<{ user: AuthUser; requiresVerification?: boolean }>;
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
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/resend-verification");
      return res.json();
    },
  });

  const login = useCallback(async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  }, [loginMutation]);

  const register = useCallback(async (username: string, email: string, password: string): Promise<RegisterResult> => {
    const result = await registerMutation.mutateAsync({ username, email, password });
    return { requiresVerification: result.requiresVerification };
  }, [registerMutation]);

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const resendVerification = useCallback(async () => {
    await resendMutation.mutateAsync();
  }, [resendMutation]);

  const extractError = (error: any): string | null => {
    if (!error) return null;
    try {
      const msg = error.message || "";
      const jsonPart = msg.includes(": ") ? msg.split(": ").slice(1).join(": ") : msg;
      const parsed = JSON.parse(jsonPart);
      return parsed.error || msg;
    } catch {
      return error.message || "Erreur inconnue";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: data?.user || null,
        isLoading,
        login,
        register,
        logout,
        resendVerification,
        loginError: extractError(loginMutation.error),
        registerError: extractError(registerMutation.error),
        isLoginPending: loginMutation.isPending,
        isRegisterPending: registerMutation.isPending,
        isResendPending: resendMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
