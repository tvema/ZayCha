import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { GlobalModalProvider } from "@/components/GlobalModalProvider";
import { ClientErrorCatcher } from "./ClientErrorCatcher";
import { CustomEmojiPreloader } from "@/lib/chatComponents";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "ZayChat",
  description: "Закрытый мессенджер для своих",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/icon-128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZayChat",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// Root layout for ZayChat
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force rebuild to clear webpack cache (attempt 4)
  return (
    <html lang="ru" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased overflow-hidden">
        <CustomEmojiPreloader />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <GlobalModalProvider>
              <ClientErrorCatcher>
                {children}
              </ClientErrorCatcher>
            </GlobalModalProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
