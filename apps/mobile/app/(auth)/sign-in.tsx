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
import { requestCode, verifyCode } from "../../lib/auth";
import { setSession } from "../../lib/session";
import { useSession } from "../../lib/session-context";
import { registerForPushNotifications } from "../../lib/notifications";

const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter your phone number with country code");
const codeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

type Step = "phone" | "code";
type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "error"; message: string };

/**
 * Two-step sign-in: phone number → 6-digit SMS code → session.
 * The _layout gate reads the stored session and routes by role.
 */
export default function SignIn() {
  const theme = useTheme();
  const { refresh } = useSession();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<Option<string>>(none());
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  async function onSendCode(): Promise<void> {
    const parsed = phoneSchema.safeParse(phone.trim());
    if (!parsed.success) {
      setFieldError(some(parsed.error.issues[0]?.message ?? "Invalid phone number"));
      return;
    }
    setFieldError(none());
    setSubmit({ status: "sending" });
    const result = await requestCode(parsed.data);
    if (!result.ok) {
      setSubmit({ status: "error", message: result.error.message });
      return;
    }
    setSubmit({ status: "idle" });
    setStep("code");
  }

  async function onVerifyCode(): Promise<void> {
    const parsed = codeSchema.safeParse(code.trim());
    if (!parsed.success) {
      setFieldError(some(parsed.error.issues[0]?.message ?? "Invalid code"));
      return;
    }
    setFieldError(none());
    setSubmit({ status: "sending" });
    const result = await verifyCode(phone.trim(), parsed.data);
    if (!result.ok) {
      setSubmit({ status: "error", message: result.error.message });
      return;
    }
    await setSession({
      token: result.value.token,
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
        <Text style={styles.subtitle}>
          {step === "phone" ? "Sign in to continue" : "Enter the code we texted you"}
        </Text>

        {step === "phone" ? (
          <>
            <Text style={styles.label}>Mobile number</Text>
            <TextInput
              style={[styles.input, fieldError.kind === "some" && styles.inputError]}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                setFieldError(none());
              }}
              placeholder="+1 555 010 2030"
              keyboardType="phone-pad"
              autoComplete="tel"
              accessibilityLabel="Mobile number"
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>6-digit code</Text>
            <TextInput
              style={[styles.input, fieldError.kind === "some" && styles.inputError]}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setFieldError(none());
              }}
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel="Six digit sign-in code"
            />
            <Pressable
              onPress={() => {
                setStep("phone");
                setCode("");
                setSubmit({ status: "idle" });
              }}
              accessibilityLabel="Use a different number"
            >
              <Text style={[styles.link, { color: theme.primaryColor }]}>
                Use a different number
              </Text>
            </Pressable>
          </>
        )}

        {fieldError.kind === "some" && <Text style={styles.error}>{fieldError.value}</Text>}
        {submit.status === "error" && <Text style={styles.error}>{submit.message}</Text>}

        <Pressable
          style={[styles.button, { backgroundColor: theme.primaryColor }]}
          onPress={() => void (step === "phone" ? onSendCode() : onVerifyCode())}
          disabled={busy}
          accessibilityLabel={step === "phone" ? "Send sign-in code" : "Verify code"}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {step === "phone" ? "Send sign-in code" : "Verify and sign in"}
            </Text>
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
  link: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  button: { borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
