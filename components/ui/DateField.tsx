import { MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatDdMmYyyy } from "@/lib/date";

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  helperText?: string;
  disabled?: boolean;
  error?: string;
};

export function DateField({ label, value, onChange, minimumDate, maximumDate, helperText, disabled, error }: Props) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        style={[styles.inputRow, disabled ? styles.inputDisabled : null, error ? styles.inputError : null]}
        onPress={() => setShow(true)}
      >
        <MaterialIcons name="calendar-today" size={18} color="#78909C" style={styles.icon} />
        <Text style={[styles.value, !value ? styles.placeholder : null]}>
          {value ? formatDdMmYyyy(value) : "Select date"}
        </Text>
      </TouchableOpacity>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
      {show ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, selectedDate) => {
            setShow(false);
            if (event.type === "set" && selectedDate) onChange(selectedDate);
          }}
        />
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
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  icon: { marginRight: 6 },
  value: { flex: 1, fontSize: 15, color: "#263238" },
  placeholder: { color: "#9AA5B1" },
  helperText: { fontSize: 11, color: "#90A4AE", marginTop: 4 },
  errorText: { fontSize: 11, color: "#D32F2F", marginTop: 4 },
  inputDisabled: { backgroundColor: "#F1F3F4", borderColor: "#E0E4E7" },
  inputError: { borderColor: "#D32F2F" },
});
