import { Stack } from "expo-router";

import { AuthProvider } from "@/context/AuthContext";
import { CoalChallanProvider } from "@/context/CoalChallanContext";
import { ToastProvider } from "@/context/ToastContext";

export default function RootLayout() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CoalChallanProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CoalChallanProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
