import { MaterialIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

type Variant = "primary" | "success" | "warning" | "error" | "outline";

type Props = {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  style?: ViewStyle;
};

const COLORS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: "#1976D2", fg: "#fff" },
  success: { bg: "#43A047", fg: "#fff" },
  warning: { bg: "#FB8C00", fg: "#fff" },
  error: { bg: "#fff", fg: "#D32F2F", border: "#D32F2F" },
  outline: { bg: "#fff", fg: "#1976D2", border: "#1976D2" },
};

export function PrimaryButton({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  loading,
  loadingLabel = "Processing...",
  style,
}: Props) {
  const c = COLORS[variant];
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        styles.btn,
        { backgroundColor: c.bg, borderColor: c.border ?? c.bg, opacity: isDisabled ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <>
          <ActivityIndicator color={c.fg} size="small" />
          <Text style={[styles.label, { color: c.fg }]}>{loadingLabel}</Text>
        </>
      ) : (
        <>
          {icon ? <MaterialIcons name={icon} size={20} color={c.fg} /> : null}
          <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  label: { fontSize: 15, fontWeight: "700" },
});
