import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "../lib/session-context";

export const metadata: Metadata = {
  title: "Hospice Care — Team Dashboard",
  description: "Care-team dashboard for the hospice connected-care platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
