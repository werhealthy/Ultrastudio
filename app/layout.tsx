import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UltraStudio | Campaign Adaptation",
  description: "A minimal campaign adaptation workspace for creative teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
