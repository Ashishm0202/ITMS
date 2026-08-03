import { MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useCoalChallan } from "@/context/CoalChallanContext";
import { useToast } from "@/context/ToastContext";
import { parseScanData } from "@/lib/qrParser";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { setScan } = useCoalChallan();
  const { show } = useToast();
  const lockedRef = useRef(false);

  function unlockAfter(ms: number) {
    setTimeout(() => {
      lockedRef.current = false;
    }, ms);
  }

  function handleBarcodeScanned(data: string) {
    if (lockedRef.current) return;
    lockedRef.current = true;

    if (!data.includes("|")) {
      show("Please Try Again", "warning");
      unlockAfter(1200);
      return;
    }

    if (data.split("|").length <= 5) {
      unlockAfter(300);
      return;
    }

    const parsed = parseScanData(data);
    if (!parsed) {
      show("Please Try Again", "warning");
      unlockAfter(1200);
      return;
    }

    setScan(parsed, data);
    router.replace("/coal-challan");
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <MaterialIcons name="camera-alt" size={48} color="#78909C" />
        <Text style={styles.permissionText}>Camera access is needed to scan the TP QR/barcode</Text>
        <PrimaryButton label="Grant Permission" onPress={requestPermission} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "code39", "datamatrix", "pdf417", "ean13"],
        }}
        onBarcodeScanned={({ data }) => handleBarcodeScanned(data)}
      />

      <View style={styles.centerWrap} pointerEvents="none">
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.hint}>Align the TP QR or barcode within the frame</Text>
      </View>

      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#F4F6F8" },
  permissionText: { textAlign: "center", marginTop: 12, color: "#455A64", fontSize: 15 },
  topBar: { position: "absolute", top: 0, left: 0, right: 0 },
  backBtn: {
    margin: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  frame: { width: 260, height: 260, borderRadius: 16 },
  corner: { position: "absolute", width: 36, height: 36, borderColor: "#fff" },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  hint: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
