import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/Card";
import { LabeledInput } from "@/components/ui/LabeledInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const { show } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!email.trim() || !password) {
      show("Please enter email and password", "warning");
      return;
    }
    setBusy(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        router.replace("/challan-creation");
      } else {
        show(result.message, "error");
      }
    } catch {
      show("Server error, failed to sign in", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={["#1E88E5", "#125EA6"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroContent}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="local-shipping" size={32} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Facor ITMS</Text>
            <Text style={styles.heroSubtitle}>Sign in to continue</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card style={styles.card}>
            <LabeledInput
              label="Email"
              icon="alternate-email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@company.com"
            />
            <LabeledInput
              label="Password"
              icon="lock-outline"
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              placeholder="Enter your password"
              rightIcon={showPassword ? "visibility-off" : "visibility"}
              onRightIconPress={() => setShowPassword((v) => !v)}
            />
            <PrimaryButton
              label="Login"
              icon="login"
              variant="primary"
              loading={busy}
              onPress={onSubmit}
              style={styles.loginBtn}
            />
          </Card>

          <Text style={styles.footer}>Facor ITMS · Coal Transit Management</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F6F8" },
  hero: {
    paddingBottom: 56,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroContent: { alignItems: "center", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: { fontSize: 24, fontWeight: "800", color: "#fff" },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 },
  scroll: { padding: 16, paddingTop: 0, flexGrow: 1, justifyContent: "center" },
  card: { marginTop: -40 },
  loginBtn: { marginTop: 8 },
  footer: { textAlign: "center", fontSize: 12, color: "#90A4AE", marginTop: 24 },
});
