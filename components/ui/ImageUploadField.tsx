import { MaterialIcons } from "@expo/vector-icons";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  label: string;
  uri: string | null;
  onChange: (dataUri: string | null) => void;
  error?: string;
};

/** Resizes to 800x600 and returns a "data:image/jpeg;base64,..." URI - mirrors the backend's own upload prep. */
async function toUploadDataUri(sourceUri: string): Promise<string> {
  const context = ImageManipulator.manipulate(sourceUri);
  context.resize({ width: 800, height: 600 });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  return `data:image/jpeg;base64,${result.base64}`;
}

export function ImageUploadField({ label, uri, onChange, error }: Props) {
  const [libraryPermission, requestLibraryPermission] = ImagePicker.useMediaLibraryPermissions();
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();
  const [processing, setProcessing] = useState(false);

  async function pickFromGallery() {
    if (!libraryPermission?.granted) {
      const res = await requestLibraryPermission();
      if (!res.granted) return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
    if (result.canceled || !result.assets?.[0]) return;
    setProcessing(true);
    try {
      onChange(await toUploadDataUri(result.assets[0].uri));
    } finally {
      setProcessing(false);
    }
  }

  async function captureFromCamera() {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"] });
    if (result.canceled || !result.assets?.[0]) return;
    setProcessing(true);
    try {
      onChange(await toUploadDataUri(result.assets[0].uri));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      {uri ? (
        <View style={styles.thumbWrap}>
          <Image source={{ uri }} style={styles.thumb} />
          <TouchableOpacity style={styles.removeBtn} onPress={() => onChange(null)}>
            <MaterialIcons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.thumb, styles.placeholder, error ? styles.placeholderError : null]}>
          {processing ? (
            <ActivityIndicator size="small" color="#1976D2" />
          ) : (
            <MaterialIcons name="image" size={26} color={error ? "#D32F2F" : "#B0BEC5"} />
          )}
        </View>
      )}

      <View style={styles.row}>
        <TouchableOpacity style={styles.actionBtn} onPress={pickFromGallery} disabled={processing}>
          <MaterialIcons name="photo-library" size={16} color="#1976D2" />
          <Text style={styles.actionText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={captureFromCamera} disabled={processing}>
          <MaterialIcons name="photo-camera" size={16} color="#1976D2" />
          <Text style={styles.actionText}>Camera</Text>
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "48%", marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: "#546E7A", marginBottom: 6 },
  thumbWrap: { position: "relative" },
  thumb: {
    width: "100%",
    aspectRatio: 1.3,
    borderRadius: 10,
    backgroundColor: "#ECEFF1",
  },
  placeholder: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#CFD8DC", borderStyle: "dashed" },
  placeholderError: { borderColor: "#D32F2F" },
  errorText: { fontSize: 11, color: "#D32F2F", marginTop: 4 },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontSize: 12, fontWeight: "600", color: "#1976D2" },
});
