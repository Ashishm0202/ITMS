import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
};

export function ActionCard({ icon, title, subtitle, color, onPress, disabled }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.card, disabled ? styles.disabled : null]}
    >
      <View style={[styles.iconBadge, { backgroundColor: `${color}1A` }]}>
        <MaterialIcons name={icon} size={30} color={color} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={26} color="#B0BEC5" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  disabled: { opacity: 0.5 },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: "#263238" },
  subtitle: { fontSize: 12, color: "#90A4AE", marginTop: 2 },
});
