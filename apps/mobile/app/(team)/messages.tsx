import { Text, View, StyleSheet } from "react-native";
import { ThreadList } from "../../components/thread-list";
import { useTheme } from "../../lib/theme";

export default function TeamMessages() {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: theme.primaryColor }]}>Messages</Text>
      <ThreadList basePath="(team)" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  heading: { fontSize: 22, fontWeight: "700", marginTop: 60, marginHorizontal: 20, marginBottom: 8 },
});
