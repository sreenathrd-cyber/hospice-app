import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../lib/theme";

/** Tappable numeric scale — no slider dependency, fully accessible. */
export function ScaleInput({
  label,
  value,
  max,
  step = 1,
  anchors,
  onChange,
}: {
  label: string;
  value: number | null;
  max: number;
  step?: number;
  anchors?: [string, string];
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  const options: number[] = [];
  for (let v = 0; v <= max; v += step) options.push(v);

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.scaleRow}>
        {options.map((v) => {
          const selected = value === v;
          return (
            <Pressable
              key={v}
              onPress={() => onChange(v)}
              accessibilityLabel={`${label}: ${v}`}
              accessibilityState={{ selected }}
              style={[
                styles.segment,
                selected
                  ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }
                  : styles.segmentIdle,
              ]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
      {anchors && (
        <View style={styles.anchors}>
          <Text style={styles.anchor}>{anchors[0]}</Text>
          <Text style={styles.anchor}>{anchors[1]}</Text>
        </View>
      )}
    </View>
  );
}

/** Segmented choice (yes/no, recency, …). */
export function ChoiceInput<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityState={{ selected }}
              style={[
                styles.choice,
                selected
                  ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }
                  : styles.segmentIdle,
              ]}
            >
              <Text style={[styles.choiceText, selected && styles.segmentTextSelected]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Stepper for counts (vomiting episodes). */
export function StepperInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={[styles.stepperButton, value <= min && styles.disabled]}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={[styles.stepperText, { color: theme.primaryColor }]}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={[styles.stepperButton, value >= max && styles.disabled]}
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={[styles.stepperText, { color: theme.primaryColor }]}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 22 },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  scaleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segment: {
    minWidth: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentIdle: { backgroundColor: "#fff", borderColor: "#D8DCD9" },
  segmentText: { fontSize: 14, fontWeight: "600", color: "#1A1D1B" },
  segmentTextSelected: { color: "#fff" },
  anchors: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  anchor: { fontSize: 12, color: "#8A918D" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    borderWidth: 1,
  },
  choiceText: { fontSize: 14, fontWeight: "600", color: "#1A1D1B" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D8DCD9",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: { fontSize: 24, fontWeight: "600" },
  stepperValue: { fontSize: 20, fontWeight: "700", minWidth: 40, textAlign: "center" },
  disabled: { opacity: 0.4 },
});
