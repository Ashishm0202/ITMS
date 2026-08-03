import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionCard } from "@/components/ui/ActionCard";
import { useAuth } from "@/context/AuthContext";
import { useCoalChallan } from "@/context/CoalChallanContext";

export default function ChallanCreationScreen() {
  const { reset } = useCoalChallan();
  const { logout } = useAuth();

  async function onLogout() {
    reset();
    await logout();
    router.replace("/login");
  }

  return (
    <View style={styles.screen}>
      <LinearGradient colors={["#1E88E5", "#125EA6"]} style={styles.hero}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
              <MaterialIcons name="logout" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.heroContent}>
            <View style={styles.heroIcon}>
              <MaterialIcons name="assessment" size={30} color="#fff" />
            </View>
            <Text style={styles.heroTitle}>Create Challan</Text>
            <Text style={styles.heroSubtitle}>Choose how you&apos;d like to create the challan</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <SafeAreaView style={styles.body} edges={["bottom"]}>
        <ActionCard
          icon="qr-code-scanner"
          title="Scan QR"
          subtitle="Scan the transit pass QR or barcode"
          color="#1976D2"
          onPress={() => {
            reset();
            router.push("/scanner");
          }}
        />
        <ActionCard
          icon="edit"
          title="Manual"
          subtitle="Enter transit pass details by hand"
          color="#FB8C00"
          onPress={() => {
            reset();
            router.push("/coal-challan");
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F6F8" },
  hero: {
    paddingBottom: 40,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  topBar: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingTop: 4 },
  logoutBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: { alignItems: "center", paddingHorizontal: 24, paddingTop: 0, paddingBottom: 8 },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: "#fff" },
  heroSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4, textAlign: "center" },
  body: { padding: 16, paddingTop: 24, gap: 16 },
});
