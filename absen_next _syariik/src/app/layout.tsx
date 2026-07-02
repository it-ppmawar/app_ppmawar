import type { Metadata, Viewport } from "next";
import { Amiri, Aref_Ruqaa, Cairo, Playfair_Display, Noto_Naskh_Arabic, Cinzel } from "next/font/google";
import "./globals.css";
import PwaProvider from "@/components/PwaProvider";

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const arefRuqaa = Aref_Ruqaa({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-diwani",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-cairo",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-playfair",
  display: "swap",
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-naskh",
  display: "swap",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-cinzel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "App PP. Tanwirul Qulub",
  description: "Sistem Absensi Online PP. Tanwirul Qulub",
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
    title: "PPTQ Absen",
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
      className={`h-full antialiased ${amiri.variable} ${arefRuqaa.variable} ${cairo.variable} ${playfair.variable} ${notoNaskh.variable} ${cinzel.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
