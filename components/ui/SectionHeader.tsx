import { MaterialIcons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  color: string;
  /** Optional action rendered at the far right of the header row. */
  right?: ReactNode;
};

export function SectionHeader({ icon, title, color, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
        <MaterialIcons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.title, { color }]} numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  right: { marginLeft: "auto", flexShrink: 0 },
});
