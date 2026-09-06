import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { GlobalModalProvider } from "@/components/GlobalModalProvider";
import { ClientErrorCatcher } from "./ClientErrorCatcher";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.addEventListener('error', function(e) {
                  var t = e.target || e.srcElement;
                  if (t && t.tagName === 'SCRIPT' && t.src && t.src.indexOf('/_next/static/') !== -1) {
                    var retries = parseInt(t.getAttribute('data-retries') || '0', 10);
                    if (retries < 3) {
                      t.setAttribute('data-retries', (retries + 1) + '');
                      setTimeout(function() {
                        var s = document.createElement('script');
                        s.src = t.src.split('?')[0] + '?retry=' + (retries + 1) + '_' + Date.now();
                        s.setAttribute('data-retries', (retries + 1) + '');
                        document.head.appendChild(s);
                      }, 400 * Math.pow(2, retries));
                    }
                  }
                }, true);
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased overflow-hidden">
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
