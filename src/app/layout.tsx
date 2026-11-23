import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FAMILY_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: FAMILY_NAME,
  description: "Private family app",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Family", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
