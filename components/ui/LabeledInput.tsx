import { MaterialIcons } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";

type Props = TextInputProps & {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  helperText?: string;
  error?: string;
  uppercase?: boolean;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  onRightIconPress?: () => void;
};

export function LabeledInput({
  label,
  icon,
  helperText,
  error,
  uppercase,
  style,
  onChangeText,
  editable = true,
  rightIcon,
  onRightIconPress,
  ...rest
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, !editable ? styles.inputDisabled : null, error ? styles.inputError : null]}>
        {icon ? <MaterialIcons name={icon} size={18} color="#78909C" style={styles.icon} /> : null}
        <TextInput
          {...rest}
          editable={editable}
          onChangeText={(t) => onChangeText?.(uppercase ? t.toUpperCase() : t)}
          placeholderTextColor="#9AA5B1"
          style={[styles.input, style]}
        />
        {rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} hitSlop={8}>
            <MaterialIcons name={rightIcon} size={18} color="#78909C" />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: "#546E7A", marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#CFD8DC",
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  inputError: { borderColor: "#D32F2F" },
  inputDisabled: { backgroundColor: "#F1F3F4", borderColor: "#E0E4E7" },
  icon: { marginRight: 6 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, color: "#263238" },
  helperText: { fontSize: 11, color: "#90A4AE", marginTop: 4 },
  errorText: { fontSize: 11, color: "#D32F2F", marginTop: 4 },
});
