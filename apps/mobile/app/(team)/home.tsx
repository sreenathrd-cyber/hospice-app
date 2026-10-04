import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../lib/theme";
import { useSession } from "../../lib/session-context";

/**
 * Care-team home. The alerts inbox and visit list populate with Features 3–4;
 * until then the empty states are the real UI — no mock patients, no fake data.
 */
export default function TeamHome() {
  const theme = useTheme();
  const { signOut } = useSession();

  return (
    <View style={styles.container}>
      <Text style={styles.agency}>{theme.agencyName} — Care team</Text>
      <Text style={styles.heading}>Today</Text>

      <Link href="/(team)/messages" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open messages">
          <Text style={styles.cardTitle}>Messages</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Open family conversations →
          </Text>
        </Pressable>
      </Link>

      <Link href="/(team)/alerts" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open alerts inbox">
          <Text style={styles.cardTitle}>Alerts inbox</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Review flagged questionnaire alerts →
          </Text>
        </Pressable>
      </Link>

      <Link href="/(team)/visits" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open visits">
          <Text style={styles.cardTitle}>Visits</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Schedule, join, and complete visits →
          </Text>
        </Pressable>
      </Link>

      <Link href="/(team)/idg" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open IDG sessions">
          <Text style={styles.cardTitle}>IDG sessions</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Consent, record, and close out →
          </Text>
        </Pressable>
      </Link>

      <Link href="/(team)/schedules" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open questionnaire schedules">
          <Text style={styles.cardTitle}>Questionnaires</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Set recurring sends, pause or resume →
          </Text>
        </Pressable>
      </Link>

      <Link href="/(team)/sia" asChild>
        <Pressable style={styles.card} accessibilityLabel="Open SIA capture">
          <Text style={styles.cardTitle}>SIA capture</Text>
          <Text style={[styles.link, { color: theme.primaryColor }]}>
            Time in-person visits, review captured revenue →
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
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 6 },
  empty: { fontSize: 14, color: "#5B625E" },
  link: { fontSize: 14, fontWeight: "600" },
  signOut: { fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 12 },
});
