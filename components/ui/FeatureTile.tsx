import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
};

export function FeatureTile({ icon, label, subtitle, color, onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tile, disabled ? styles.disabled : null]}
    >
      <View style={[styles.iconBadge, { backgroundColor: `${color}1A` }]}>
        <MaterialIcons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  disabled: { opacity: 0.5 },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  label: { fontSize: 15, fontWeight: "700", color: "#263238" },
  subtitle: { fontSize: 11, color: "#90A4AE" },
});
