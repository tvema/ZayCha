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
                window.__ZAYCHAT_LOGS = window.__ZAYCHAT_LOGS || [];
                window.__addZayChatLog = function(level, msg, extra) {
                  var ts = new Date().toTimeString().split(' ')[0];
                  var entry = { time: ts, level: level, msg: String(msg) + (extra ? ' ' + JSON.stringify(extra) : '') };
                  window.__ZAYCHAT_LOGS.push(entry);
                  if (window.__ZAYCHAT_LOGS.length > 200) window.__ZAYCHAT_LOGS.shift();
                  window.dispatchEvent(new CustomEvent('zaychat:new_log', { detail: entry }));
                };

                // Intercept console to mirror in visual diagnostic log
                var origLog = console.log;
                var origWarn = console.warn;
                var origErr = console.error;
                console.log = function() {
                  var args = Array.prototype.slice.call(arguments);
                  origLog.apply(console, args);
                  window.__addZayChatLog('info', args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' '));
                };
                console.warn = function() {
                  var args = Array.prototype.slice.call(arguments);
                  origWarn.apply(console, args);
                  window.__addZayChatLog('warn', args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' '));
                };
                console.error = function() {
                  var args = Array.prototype.slice.call(arguments);
                  origErr.apply(console, args);
                  window.__addZayChatLog('error', args.map(function(a) { return typeof a === 'object' ? (a && a.stack ? a.stack : JSON.stringify(a)) : String(a); }).join(' '));
                };

                console.log('🚀 [Boot 1/5] HTML получен браузером. Старт диагностики...');
                try {
                  var token = localStorage.getItem('token');
                  var user = localStorage.getItem('user');
                  console.log('🔑 [Boot 2/5] Проверка localStorage: token=' + (token ? 'ЕСТЬ' : 'НЕТ') + ', user=' + (user ? 'ЕСТЬ' : 'НЕТ'));
                } catch(e) {
                  console.warn('⚠️ [Boot 2/5] Ошибка чтения localStorage:', e.message);
                }

                // Global error listener
                window.addEventListener('error', function(e) {
                  var t = e.target || e.srcElement;
                  if (t && t.tagName === 'SCRIPT' && t.src) {
                    var scriptName = t.src.split('/').pop().split('?')[0];
                    console.error('❌ [Script Load Fail] Ошибка загрузки чанка: ' + scriptName + ' URL: ' + t.src);
                    var retries = parseInt(t.getAttribute('data-retries') || '0', 10);
                    if (retries < 3) {
                      t.setAttribute('data-retries', (retries + 1) + '');
                      console.log('🔄 [Script Retry] Повторная попытка (' + (retries + 1) + '/3) для ' + scriptName);
                      setTimeout(function() {
                        var s = document.createElement('script');
                        s.src = t.src.split('?')[0] + '?retry=' + (retries + 1) + '_' + Date.now();
                        s.setAttribute('data-retries', (retries + 1) + '');
                        document.head.appendChild(s);
                      }, 400 * Math.pow(2, retries));
                    }
                  } else {
                    var errMsg = '❌ [Window Error] ' + (e.message || 'Unknown error') + (e.filename ? ' at ' + e.filename + ':' + (e.lineno || '') : '');
                    window.__addZayChatLog('error', errMsg);
                    origErr.call(console, errMsg);
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(e) {
                  var rejMsg = '❌ [Unhandled Promise] ' + (e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'Promise rejected');
                  window.__addZayChatLog('error', rejMsg);
                  origErr.call(console, rejMsg);
                });

                document.addEventListener('DOMContentLoaded', function() {
                  console.log('📄 [Boot 3/5] DOMContentLoaded - базовый DOM готов.');
                });

                window.addEventListener('load', function() {
                  console.log('🌐 [Boot 4/5] Window Loaded - все ресурсы страницы загружены.');
                });
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
