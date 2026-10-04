import { Link } from "expo-router";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { useSession } from "../../lib/session-context";

/**
 * Family home. The call button dials the agency's care line straight from
 * the phone app — no in-app VoIP, no Telnyx voice SDK, just a phone call.
 */
export default function PatientHome() {
  const theme = useTheme();
  const { signOut } = useSession();

  function callCareTeam() {
    if (!theme.careLinePhone) {
      Alert.alert("No care line set", "Your agency hasn't published a care line yet. Message them instead.");
      return;
    }
    void Linking.openURL(`tel:${theme.careLinePhone}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.agency}>{theme.agencyName}</Text>
      <Text style={styles.heading}>How are you feeling today?</Text>

      <Pressable
        style={[styles.callButton, { backgroundColor: theme.primaryColor }]}
        onPress={callCareTeam}
        accessibilityLabel="Call your care team"
      >
        <Text style={styles.callButtonText}>📞 Call your care team</Text>
      </Pressable>

      <Link href="/(patient)/messages" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open messages">
          <Text style={styles.cardTitle}>Messages</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Open conversations with your care team →
          </Text>
        </Pressable>
      </Link>

      <Link href="/(patient)/questionnaires" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open questionnaires">
          <Text style={styles.cardTitle}>Questionnaires</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Complete your assigned check-ins →
          </Text>
        </Pressable>
      </Link>

      <Link href="/(patient)/visits" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open visits">
          <Text style={styles.cardTitle}>Upcoming visits</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Join video visits and see what's scheduled →
          </Text>
        </Pressable>
      </Link>

      <Pressable onPress={() => void signOut()} accessibilityLabel="Sign out">
        <Text style={[styles.signOut, { color: theme.primaryColor }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#F7F8F7" },
  agency: { fontSize: 13, fontWeight: "600", color: "#5B625E", marginTop: 48, marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 20 },
  callButton: { borderRadius: 22, paddingVertical: 14, alignItems: "center", marginBottom: 14 },
  callButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  empty: { fontSize: 14, color: "#5B625E" },
  link: { fontSize: 14, fontWeight: "600" },
  signOut: { fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 12 },
});
