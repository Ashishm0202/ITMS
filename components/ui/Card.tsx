import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

type Props = PropsWithChildren<{ style?: ViewStyle; accentColor?: string }>;

export function Card({ children, style, accentColor }: Props) {
  return (
    <View
      style={[
        styles.card,
        accentColor
          ? { backgroundColor: `${accentColor}0A`, borderLeftWidth: 4, borderLeftColor: accentColor }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#1E293B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
});
