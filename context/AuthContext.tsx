import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { AuthUser, setCurrentUser } from "@/lib/authStore";
import { decrypt } from "@/lib/cryptoUtils";
import { getFieldCI } from "@/lib/object";
import { getUserByEmail } from "@/services/api";

const STORAGE_KEY = "itms_auth_user";

export type { AuthUser };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Mirror every user change into the non-React snapshot so services/api.ts can read it.
  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setUser(JSON.parse(stored));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim() || !password) {
      return { success: false, message: "Please enter email and password" };
    }
    const result = await getUserByEmail(email.trim());
    if (!result.success || !result.user) {
      return { success: false, message: result.message || "User not found" };
    }

    const encryptedPassword = getFieldCI(result.user, "password");
    if (!encryptedPassword) {
      return { success: false, message: "Server did not return password data" };
    }

    let decryptedPassword: string;
    try {
      decryptedPassword = decrypt(encryptedPassword);
    } catch {
      return { success: false, message: "Could not verify password" };
    }

    if (decryptedPassword !== password) {
      return { success: false, message: "Invalid password" };
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(result.user));
    setUser(result.user);
    return { success: true, message: "Login successful" };
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
