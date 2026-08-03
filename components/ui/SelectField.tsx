import { MaterialIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Option = { label: string; value: string };

type Props = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  icon?: keyof typeof MaterialIcons.glyphMap;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
};

export function SelectField({
  label,
  value,
  options,
  onChange,
  icon,
  placeholder = "Select...",
  disabled,
  searchable,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.inputRow, disabled ? styles.disabled : null]}
      >
        {icon ? <MaterialIcons name={icon} size={18} color="#78909C" style={styles.icon} /> : null}
        <Text style={[styles.value, !selected ? styles.placeholder : null]}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={22} color="#78909C" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>{label}</Text>
            {searchable ? (
              <View style={styles.searchRow}>
                <MaterialIcons name="search" size={18} color="#78909C" style={styles.icon} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search..."
                  placeholderTextColor="#9AA5B1"
                  style={styles.searchInput}
                  autoFocus
                />
              </View>
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    close();
                  }}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                  {item.value === value ? (
                    <MaterialIcons name="check" size={18} color="#1976D2" />
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No options available</Text>}
            />
          </View>
        </Pressable>
      </Modal>
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
  disabled: { backgroundColor: "#F5F5F5" },
  icon: { marginRight: 6 },
  value: { flex: 1, fontSize: 15, color: "#263238" },
  placeholder: { color: "#9AA5B1" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "70%",
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: "#263238" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#CFD8DC",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: "#263238" },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  optionText: { fontSize: 15, color: "#263238" },
  empty: { textAlign: "center", color: "#90A4AE", paddingVertical: 20 },
});
