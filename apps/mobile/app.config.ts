import type { ExpoConfig } from "expo/config";

/**
 * White-label entry point. Agency theming (name, colors, logo) resolves at
 * RUNTIME from the API — this config only carries public-safe defaults.
 * Per-agency binaries (separate bundle IDs) are a future option, not the default.
 */
const config: ExpoConfig = {
  name: "Hospice Care",
  slug: "hospice-care",
  version: "0.1.0",
  scheme: "hospicecare",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: "com.optimiq.hospicecare",
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: "Video visits need camera access so your care team can see you.",
      NSMicrophoneUsageDescription: "Video visits need microphone access so your care team can hear you.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.optimiq.hospicecare",
    adaptiveIcon: { backgroundColor: "#1F6F5B" },
    permissions: ["CAMERA", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"],
  },
  plugins: ["expo-router", "expo-secure-store"],
  experiments: { typedRoutes: true },
  extra: {
    apiBaseUrl: process.env.API_BASE_URL ?? "http://localhost:3001",
    eas: { projectId: "45cf1be5-7921-452c-9e33-2dbfaaac666a" },
  },
};

export default config;
