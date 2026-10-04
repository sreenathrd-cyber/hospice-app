import { createContext, useContext, type ReactNode } from "react";
import { defaultTheme, type AgencyTheme } from "@repo/types";

/**
 * White-label theme. Resolved ONCE at the root from the agency config —
 * screens consume it via useTheme() and never branch on agency identity.
 */
const ThemeContext = createContext<AgencyTheme>({ ...defaultTheme });

export function ThemeProvider({
  theme,
  children,
}: {
  theme: AgencyTheme;
  children: ReactNode;
}) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AgencyTheme {
  return useContext(ThemeContext);
}
