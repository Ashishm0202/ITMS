import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";

type Props = {
  visible: boolean;
  message?: string;
};

/**
 * Full-screen blocking spinner. Rendered in a Modal so it sits above the scroll view and any
 * open keyboard, and swallows taps while a request is in flight. The Android hardware back
 * button is intentionally a no-op here - the overlay clears when the request settles.
 */
export function LoadingOverlay({ visible, message = "Please wait..." }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ActivityIndicator size="large" color="#1976D2" />
          {message ? <Text style={styles.text}>{message}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    minWidth: 150,
    paddingHorizontal: 26,
    paddingVertical: 22,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    gap: 12,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { fontSize: 14, fontWeight: "600", color: "#37474F", textAlign: "center" },
});
