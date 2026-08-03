import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  color: string;
};

export function SectionHeader({ icon, title, color }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
        <MaterialIcons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.title, { color }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
});
