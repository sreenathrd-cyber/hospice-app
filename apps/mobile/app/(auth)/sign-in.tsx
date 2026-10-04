import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { z } from "zod";
import { none, some, type Option } from "@repo/types";
import { useTheme } from "../../lib/theme";
import { login } from "../../lib/auth";
import { setSession } from "../../lib/session";
import { useSession } from "../../lib/session-context";
import { registerForPushNotifications } from "../../lib/notifications";

const emailSchema = z.string().email("Enter a valid email address");
const passwordSchema = z.string().min(1, "Enter your password");

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "error"; message: string };

/**
 * Email/password sign-in → session.
 * The _layout gate reads the stored session and routes by role.
 */
export default function SignIn() {
  const theme = useTheme();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<Option<string>>(none());
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  async function onSignIn(): Promise<void> {
    const emailParsed = emailSchema.safeParse(email.trim());
    if (!emailParsed.success) {
      setFieldError(some(emailParsed.error.issues[0]?.message ?? "Invalid email"));
      return;
    }
    const passwordParsed = passwordSchema.safeParse(password);
    if (!passwordParsed.success) {
      setFieldError(some(passwordParsed.error.issues[0]?.message ?? "Invalid password"));
      return;
    }
    setFieldError(none());
    setSubmit({ status: "sending" });
    const result = await login(emailParsed.data, passwordParsed.data);
    if (!result.ok) {
      setSubmit({ status: "error", message: result.error.message });
      return;
    }
    await setSession({
      token: <redacted>
      userId: result.value.userId,
      role: result.value.role,
      tenantId: result.value.tenantId,
      theme: result.value.theme,
    });
    // Register this device for push alerts, then let the root gate route by role.
    await registerForPushNotifications();
    await refresh();
  }

  const busy = submit.status === "sending";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{theme.agencyName}</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, fieldError.kind === "some" && styles.inputError]}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setFieldError(none());
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          accessibilityLabel="Email address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, fieldError.kind === "some" && styles.inputError]}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setFieldError(none());
          }}
          placeholder="Your password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          accessibilityLabel="Password"
        />

        {fieldError.kind === "some" && <Text style={styles.error}>{fieldError.value}</Text>}
        {submit.status === "error" && <Text style={styles.error}>{submit.message}</Text>}

        <Pressable
          style={[styles.button, { backgroundColor: theme.primaryColor }]}
          onPress={() => void onSignIn()}
          disabled={busy}
          accessibilityLabel="Sign in"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F7F8F7" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#5B625E", marginBottom: 24 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#D8DCD9",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 8,
  },
  inputError: { borderColor: "#C0392B" },
  error: { color: "#C0392B", fontSize: 13, marginBottom: 8 },
  button: { borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
