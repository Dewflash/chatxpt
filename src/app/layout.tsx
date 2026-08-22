import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatXPT — Livestream Sidequests",
  description: "Turn live gameplay and chat energy into viewer-voted sidequests.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
