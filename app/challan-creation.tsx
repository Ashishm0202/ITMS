import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionCard } from "@/components/ui/ActionCard";
import { Card } from "@/components/ui/Card";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useAuth } from "@/context/AuthContext";
import { useCoalChallan } from "@/context/CoalChallanContext";
import { getImageUrl, uploadImage } from "@/services/api";
import { ImageResponse, ImageUploadRequest } from "@/types/models";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
/** Bucket folder the challan photos land in server-side. */
const UPLOAD_FOLDER = "QRChallan";
/** Extension the bucket names every challan image with. */
const UPLOAD_EXT = "png";
/** On-screen label of the photo, and the stem of its stored file name. */
const IMAGE_FIELD_LABEL = "QR Challan";
/** "QRChallan/<Label><yyyymmdd><mm><ss>.png" - the folderName shape the bucket accepts. */
const FOLDER_NAME_PATTERN = new RegExp(`^${UPLOAD_FOLDER}/[A-Za-z0-9]+\\d{12}\\.${UPLOAD_EXT}$`);

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Builds the bucket path: the field label (stripped to alphanumerics so spaces/slashes can't break
 * the path) followed by a yyyymmdd date and the minute+second of the upload, e.g.
 * "QRChallan/QRChallan202608141453.png".
 */
function buildFolderName(label: string, now: Date): string {
  const stem = label.replace(/[^A-Za-z0-9]/g, "");
  const stamp =
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}` +
    `${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `${UPLOAD_FOLDER}/${stem}${stamp}.${UPLOAD_EXT}`;
}

/** Guards the generated name against the pattern before anything is sent to the bucket. */
function validateFolderName(folderName: string): string | null {
  if (!FOLDER_NAME_PATTERN.test(folderName)) {
    return `Invalid file name "${folderName}" - expected ${UPLOAD_FOLDER}/<label><yyyymmdd><mm><ss>.${UPLOAD_EXT}`;
  }
  return null;
}

/**
 * ImageUploadField hands back a "data:image/jpeg;base64,..." URI, but ImageUploadRequest wants the
 * raw base64 in "bytes" and the extension in "fileType" - so the prefix is split off here.
 */
function toUploadRequest(dataUri: string, folderName: string): ImageUploadRequest {
  const match = /^data:(.+?);base64,(.*)$/s.exec(dataUri);
  const bytes = match?.[2] ?? dataUri;
  return { folderName, bytes, fileType: UPLOAD_EXT };
}

/** The API can answer with a full URL or a bucket-relative path; <Image> needs an absolute one. */
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `${BASE_URL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

export default function ChallanCreationScreen() {
  const { reset } = useCoalChallan();
  const { logout } = useAuth();

  const [pickedUri, setPickedUri] = useState<string | null>(null);
  /** Step 1's result - the bucket-relative path the bytes were stored at. */
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  /** Step 2's result - the absolute URL <Image> can render. */
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  function onPickImage(dataUri: string | null) {
    setPickedUri(dataUri);
    // A new pick invalidates whatever is already on the server side of the section.
    setUploadedPath(null);
    setUploadedUrl(null);
    setStatus(null);
  }

  /** Step 1 - POST the bytes; the response's "data" is the stored image path. */
  async function onUpload() {
    if (!pickedUri) return;

    const folderName = buildFolderName(IMAGE_FIELD_LABEL, new Date());
    const invalid = validateFolderName(folderName);
    if (invalid) {
      setStatus({ type: "error", message: invalid });
      return;
    }

    setUploading(true);
    setStatus(null);
    setUploadedPath(null);
    setUploadedUrl(null);
    try {
      console.log(`Uploading image to bucket path "${folderName}"...`);

      const uploaded: ImageResponse = await uploadImage(toUploadRequest(pickedUri, folderName));
      if (!uploaded.success || !uploaded.data) {
        setStatus({ type: "error", message: uploaded.message || "Upload failed" });
        return;
      }

      console.log(`Uploaded image path: ${uploaded.data}`);

      setUploadedPath(uploaded.data);
      setStatus({ type: "success", message: uploaded.message || "Image uploaded" });
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
    }
  }

  /** Step 2 - hand the stored path to ShortenUrl; its "data" is the viewable URL. Runs on its own so
   *  a failed/empty ShortenUrl can be retried without re-uploading the bytes. */
  async function onResolveUrl() {
    if (!uploadedPath) return;

    setResolving(true);
    setStatus(null);
    try {
      console.log(`Resolving viewable URL for path: ${uploadedPath}`);

      const viewable: ImageResponse = await getImageUrl(uploadedPath);
      if (!viewable.success || !viewable.data) {
        setStatus({ type: "error", message: viewable.message || "Could not resolve the image URL" });
        return;
      }

      console.log(`Viewable image URL: ${viewable}`);

      setUploadedUrl(absoluteUrl(viewable.data));
      setStatus({ type: "success", message: viewable.message || "Image URL ready" });
    } catch (e) {
      setStatus({ type: "error", message: e instanceof Error ? e.message : "Could not resolve the image URL" });
    } finally {
      setResolving(false);
    }
  }

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

      <SafeAreaView style={styles.bodySafe} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
          {/* <ActionCard
            icon="edit"
            title="Manual"
            subtitle="Enter transit pass details by hand"
            color="#FB8C00"
            onPress={() => {
              reset();
              router.push("/coal-challan");
            }}
          /> */}
          <ActionCard
            icon="change-circle"
            title="Change"
            subtitle="Change the transit pass details"
            color="#0079fb"
            onPress={() => {
              reset();
              router.push("/Preview_challan");
            }}
          />

          {/* <Card>
            <SectionHeader icon="cloud-upload" title="Image Upload" color="#607D8B" />
            <View style={styles.imageRow}>
              <ImageUploadField label={IMAGE_FIELD_LABEL} uri={pickedUri} onChange={onPickImage} />

              <View style={styles.preview}>
                <Text style={styles.previewLabel}>Uploaded Image</Text>
                {uploadedUrl ? (
                  <Image source={{ uri: uploadedUrl }} style={styles.previewImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.previewImage, styles.previewPlaceholder]}>
                    {uploading || resolving ? (
                      <ActivityIndicator size="small" color="#1976D2" />
                    ) : (
                      <MaterialIcons name="cloud-off" size={26} color="#B0BEC5" />
                    )}
                  </View>
                )}
                {uploadedUrl || uploadedPath ? (
                  <Text style={styles.previewUrl} numberOfLines={2}>
                    {uploadedUrl ?? uploadedPath}
                  </Text>
                ) : null}
              </View>
            </View>

            <PrimaryButton
              label="Upload Image"
              icon="cloud-upload"
              loading={uploading}
              loadingLabel="Uploading..."
              disabled={!pickedUri || resolving}
              onPress={onUpload}
            />

            <PrimaryButton
              label={uploadedUrl ? "Refresh Image URL" : "Get Image URL"}
              icon="link"
              variant="outline"
              loading={resolving}
              loadingLabel="Resolving..."
              disabled={!uploadedPath || uploading}
              onPress={onResolveUrl}
              style={styles.secondaryBtn}
            />

            {status ? (
              <Text style={[styles.status, status.type === "error" ? styles.statusError : styles.statusSuccess]}>
                {status.message}
              </Text>
            ) : null}
          </Card> */}
        </ScrollView>
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
  bodySafe: { flex: 1 },
  body: { padding: 16, paddingTop: 24, paddingBottom: 32, gap: 16 },
  imageRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  preview: { width: "48%", marginBottom: 14 },
  previewLabel: { fontSize: 12, fontWeight: "600", color: "#546E7A", marginBottom: 6 },
  previewImage: { width: "100%", aspectRatio: 1.3, borderRadius: 10, backgroundColor: "#ECEFF1" },
  previewPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CFD8DC",
    borderStyle: "dashed",
  },
  previewUrl: { fontSize: 10, color: "#78909C", marginTop: 6 },
  secondaryBtn: { marginTop: 10 },
  status: { fontSize: 12, marginTop: 10, textAlign: "center" },
  statusError: { color: "#D32F2F" },
  statusSuccess: { color: "#2E7D32" },
});
