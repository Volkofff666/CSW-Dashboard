import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSW Dashboard",
  description: "Conversational Sales Widget dashboard"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

