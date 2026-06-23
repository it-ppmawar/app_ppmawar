import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaProvider from "@/components/PwaProvider";

export const metadata: Metadata = {
  title: "Salam Mawar - PP. Matholi'ul Anwar",
  description: "Sistem Absensi Online PP. Matholi'ul Anwar",
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
    title: "Salam Mawar",
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
        {/* Anti-flash script: baca preferensi font dari localStorage sebelum render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var fontHero = localStorage.getItem('font_hero') || 'cinzel';
                  var fontContent = localStorage.getItem('font_content') || 'courier';
                  var fontArabic = localStorage.getItem('font_arabic') || 'aref';
                  var htmlEl = document.documentElement;
                  htmlEl.setAttribute('data-font-hero', fontHero);
                  htmlEl.setAttribute('data-font-content', fontContent);
                  htmlEl.setAttribute('data-font-arabic', fontArabic);
                } catch(e) {}
              })();
            `,
          }}
        />
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
