import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  visible: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  highlightLabel?: string;
  highlightValue?: string;
};

const THEME = {
  success: { accent: "#2E7D32", tint: "#E8F5E9", icon: "check" as const },
  error: { accent: "#C62828", tint: "#FDECEA", icon: "priority-high" as const },
};

export function ResultDialog({
  visible,
  type,
  title,
  message,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  highlightLabel,
  highlightValue,
}: Props) {
  const badgeScale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!visible) return;
    badgeScale.setValue(0);
    cardOpacity.setValue(0);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0.5);

    Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    Animated.spring(badgeScale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
    Animated.parallel([
      Animated.timing(ringScale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [visible, badgeScale, cardOpacity, ringScale, ringOpacity]);

  const theme = THEME[type];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onPrimaryPress}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { opacity: cardOpacity }]}>
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.ring,
                { borderColor: theme.accent, opacity: ringOpacity, transform: [{ scale: ringScale }] },
              ]}
            />
            <Animated.View
              style={[styles.badge, { backgroundColor: theme.tint, transform: [{ scale: badgeScale }] }]}
            >
              <View style={[styles.badgeInner, { backgroundColor: theme.accent }]}>
                <MaterialIcons name={theme.icon} size={36} color="#fff" />
              </View>
            </Animated.View>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {highlightValue ? (
            <View style={[styles.highlight, { borderColor: theme.accent, backgroundColor: theme.tint }]}>
              <View style={[styles.highlightIcon, { backgroundColor: theme.accent }]}>
                <MaterialIcons name="local-shipping" size={16} color="#fff" />
              </View>
              <View style={styles.highlightText}>
                {highlightLabel ? (
                  <Text style={[styles.highlightLabel, { color: theme.accent }]}>{highlightLabel}</Text>
                ) : null}
                <Text style={styles.highlightValue}>{highlightValue}</Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            onPress={onPrimaryPress}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </TouchableOpacity>

          {secondaryLabel ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={onSecondaryPress} activeOpacity={0.6}>
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,32,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  badgeWrap: {
    width: 92,
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  ring: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1A2027",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#5C6773",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  highlight: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  highlightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightText: { flex: 1 },
  highlightLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  highlightValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A2027",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { marginTop: 14, paddingVertical: 4 },
  secondaryText: { color: "#78838F", fontSize: 13, fontWeight: "600" },
});
