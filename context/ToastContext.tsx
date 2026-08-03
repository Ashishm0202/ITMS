import { MaterialIcons } from "@expo/vector-icons";
import { createContext, PropsWithChildren, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";

type Severity = "success" | "warning" | "error" | "info";

type ToastState = { message: string; severity: Severity } | null;

type ToastContextValue = {
  show: (message: string, severity?: Severity) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const COLORS: Record<Severity, { bg: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  success: { bg: "#43A047", icon: "check-circle" },
  warning: { bg: "#FB8C00", icon: "warning" },
  error: { bg: "#D32F2F", icon: "error" },
  info: { bg: "#1976D2", icon: "info" },
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, severity: Severity = "info") => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      // Defensive: an untrusted API response could hand back a non-string here despite the
      // type signature - never let that reach <Text> as a raw object and crash the screen.
      const safeMessage = typeof message === "string" ? message : JSON.stringify(message);
      setToast({ message: safeMessage, severity });
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setToast(null)
        );
      }, 3000);
    },
    [opacity]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { opacity, backgroundColor: COLORS[toast.severity].bg }]}
        >
          <MaterialIcons name={COLORS[toast.severity].icon} size={20} color="#fff" />
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  text: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1 },
});
