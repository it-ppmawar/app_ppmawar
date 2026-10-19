import type { Metadata, Viewport } from "next";
// Google Fonts dimuat via CSS @import di globals.css agar build berjalan di VPS tanpa akses jaringan Google
import "./globals.css";
import PwaProvider from "@/components/PwaProvider";

export const metadata: Metadata = {
  title: "App PP. Matholi'ul Anwar",
  description: "Sistem Aplikasi Layanan Akademik PP. Matholi'ul Anwar",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/logo.png', type: 'image/png' }
    ],
    apple: [
      { url: '/logo.png', type: 'image/png' }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PpMawar",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
