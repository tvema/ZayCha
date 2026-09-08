import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { GlobalModalProvider } from "@/components/GlobalModalProvider";
import { ClientErrorCatcher } from "./ClientErrorCatcher";

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

const BOOT_SPLASH_HTML = `
<div class="fixed inset-0 bg-neutral-950 text-white flex flex-col items-center justify-center p-4 z-50 overflow-y-auto select-none font-sans">
  <div class="relative mb-4 shrink-0">
    <div class="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 animate-pulse">
      <span class="text-2xl font-bold">Z</span>
    </div>
    <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-neutral-950 animate-ping"></div>
  </div>
  <h1 class="text-xl font-semibold tracking-tight mb-1 text-center">ZayChat</h1>
  <p class="text-neutral-400 text-xs mb-3 animate-pulse text-center">
    Защищенное соединение по HTTPS...
  </p>
  <div class="w-48 h-1 bg-neutral-800 rounded-full overflow-hidden mb-3 shrink-0">
    <div class="w-full h-full bg-indigo-500 animate-pulse"></div>
  </div>

  <div id="zaychat-boot-steps" class="w-full max-w-md px-3 mb-2 space-y-1.5 text-xs font-mono text-neutral-300">
    <div id="step-html" class="flex items-center justify-between p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
      <span class="flex items-center gap-2">
        <span id="step-html-dot" class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
        <span>1. Базовый HTML</span>
      </span>
      <span id="step-html-status" class="text-emerald-400 font-medium text-[11px]">Готово ✅</span>
    </div>
    <div id="step-session" class="flex items-center justify-between p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
      <span class="flex items-center gap-2">
        <span id="step-session-dot" class="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
        <span>2. Проверка сессии</span>
      </span>
      <span id="step-session-status" class="text-amber-400 font-medium text-[11px]">Проверка...</span>
    </div>
    <div id="step-scripts" class="flex items-center justify-between p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
      <span class="flex items-center gap-2">
        <span id="step-scripts-dot" class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
        <span>3. Загрузка модулей (JS)</span>
      </span>
      <span id="step-scripts-status" class="text-indigo-400 font-medium text-[11px]">Загрузка...</span>
    </div>
    <div id="step-app" class="flex items-center justify-between p-2 rounded-lg bg-neutral-900/80 border border-neutral-800">
      <span class="flex items-center gap-2">
        <span id="step-app-dot" class="w-2 h-2 rounded-full bg-neutral-600 shrink-0"></span>
        <span>4. Запуск интерфейса</span>
      </span>
      <span id="step-app-status" class="text-neutral-400 font-medium text-[11px]">Ожидание модулей...</span>
    </div>
  </div>

  <div id="zaychat-slow-hint" class="hidden w-full max-w-md px-3 mb-2">
    <div class="flex flex-col gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs">
      <div class="flex items-center justify-between">
        <span>⏳ Загрузка занимает больше времени, чем обычно...</span>
        <button onclick="window.location.reload()" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded text-[11px] cursor-pointer">
          Обновить
        </button>
      </div>
      <div class="flex items-center gap-2 pt-1 border-t border-amber-900/40 text-[11px]">
        <button onclick="window.location.href='/login'" class="text-indigo-400 hover:underline cursor-pointer">Перейти на страницу входа →</button>
        <span class="text-neutral-500">|</span>
        <button onclick="window.__resetSession()" class="text-rose-400 hover:underline cursor-pointer">Сбросить сессию</button>
      </div>
    </div>
  </div>

  <div id="zaychat-net-hint" class="hidden w-full max-w-md px-3 mb-2">
    <div class="flex items-center justify-between p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs">
      <span class="flex items-center gap-1.5">
        <span>⚠️</span>
        <span>Связь прервалась (сбой сети)</span>
      </span>
      <button onclick="window.location.reload()" class="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded text-[11px] cursor-pointer">
        Обновить
      </button>
    </div>
  </div>

  <div class="w-full max-w-md px-3">
    <div class="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
      <div onclick="window.__toggleZayLogs()" class="flex items-center justify-between px-3 py-2 bg-neutral-800/60 hover:bg-neutral-800 cursor-pointer transition-colors select-none">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <span class="text-xs font-mono font-medium text-neutral-300">
            Журнал загрузки (<span id="zaychat-log-counter">0</span>)
          </span>
        </div>
        <span id="zaychat-log-toggle-btn" class="text-[10px] uppercase font-mono text-neutral-500">Свернуть</span>
      </div>

      <div id="zaychat-live-log-container" class="p-3 bg-neutral-950/90">
        <div id="zaychat-live-logs" class="h-36 overflow-y-auto space-y-1 text-[11px] font-mono scrollbar-thin scrollbar-thumb-neutral-700">
        </div>

        <div class="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-neutral-800 text-xs">
          <button onclick="window.__copyLogs()" type="button" class="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer">
            <span>Копировать лог</span>
          </button>
          <div class="flex items-center gap-1.5">
            <button onclick="window.location.reload()" type="button" class="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer" title="Обновить страницу">
              <span>↻ Обновить</span>
            </button>
            <button onclick="window.location.href='/login'" type="button" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors cursor-pointer">
              <span>Войти</span>
            </button>
            <button onclick="window.__resetSession()" type="button" class="px-2 py-1.5 bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer" title="Сбросить сессию">
              <span>✕ Сброс</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// Root layout for ZayChat
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force rebuild to clear webpack cache (attempt 4)
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                window.__ZAYCHAT_LOGS = window.__ZAYCHAT_LOGS || [];
                var loadedChunksCount = 0;

                function updateStep(id, text, colorClass, dotColorClass) {
                  var el = document.getElementById(id + '-status');
                  if (el) {
                    el.textContent = text;
                    if (colorClass) el.className = colorClass;
                  }
                  var dot = document.getElementById(id + '-dot');
                  if (dot && dotColorClass) {
                    dot.className = dotColorClass;
                  }
                }

                function appendLiveLog(entry) {
                  var container = document.getElementById('zaychat-live-logs');
                  if (container) {
                    var line = document.createElement('div');
                    line.className = 'flex items-start gap-1.5 leading-relaxed break-words py-0.5 border-b border-neutral-900/60';
                    var color = entry.level === 'error' ? 'text-rose-400' : (entry.level === 'warn' ? 'text-amber-400' : 'text-neutral-300');
                    var badgeColor = entry.level === 'error' ? 'text-rose-400 font-bold' : (entry.level === 'warn' ? 'text-amber-400 font-bold' : 'text-indigo-400 font-medium');
                    var badge = entry.level === 'error' ? 'ERR' : (entry.level === 'warn' ? 'WRN' : 'INF');
                    
                    var timeSpan = document.createElement('span');
                    timeSpan.className = 'text-neutral-600 shrink-0 select-none text-[10px]';
                    timeSpan.textContent = '[' + entry.time + ']';

                    var badgeSpan = document.createElement('span');
                    badgeSpan.className = 'shrink-0 text-[10px] ' + badgeColor;
                    badgeSpan.textContent = badge;

                    var msgSpan = document.createElement('span');
                    msgSpan.className = 'flex-1 text-[11px] ' + color;
                    msgSpan.textContent = entry.msg || '';

                    line.appendChild(timeSpan);
                    line.appendChild(badgeSpan);
                    line.appendChild(msgSpan);
                    container.appendChild(line);
                    container.scrollTop = container.scrollHeight;
                  }
                  var counter = document.getElementById('zaychat-log-counter');
                  if (counter) counter.textContent = window.__ZAYCHAT_LOGS.length + '';
                  var preview = document.getElementById('zaychat-log-preview');
                  if (preview) preview.textContent = '[' + entry.time + '] ' + entry.msg;
                }

                window.__addZayChatLog = function(level, msg, extra) {
                  var ts = new Date().toTimeString().split(' ')[0];
                  var entry = { time: ts, level: level, msg: String(msg) + (extra ? ' ' + JSON.stringify(extra) : '') };
                  window.__ZAYCHAT_LOGS.push(entry);
                  if (window.__ZAYCHAT_LOGS.length > 300) window.__ZAYCHAT_LOGS.shift();
                  appendLiveLog(entry);
                  window.dispatchEvent(new CustomEvent('zaychat:new_log', { detail: entry }));
                };

                window.__copyLogs = function() {
                  var text = (window.__ZAYCHAT_LOGS || []).map(function(l) {
                    return '[' + l.time + '] [' + (l.level || 'info').toUpperCase() + '] ' + l.msg;
                  }).join('\\n');
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function() {
                      alert('Журнал скопирован в буфер обмена (' + window.__ZAYCHAT_LOGS.length + ' записей)');
                    }).catch(function() {
                      prompt('Скопируйте журнал вручную:', text);
                    });
                  } else {
                    prompt('Скопируйте журнал вручную:', text);
                  }
                };

                window.__toggleZayLogs = function() {
                  var panel = document.getElementById('zaychat-live-log-container');
                  var btn = document.getElementById('zaychat-log-toggle-btn');
                  if (panel) {
                    var isHidden = panel.classList.contains('hidden');
                    if (isHidden) {
                      panel.classList.remove('hidden');
                      if (btn) btn.textContent = 'Свернуть';
                    } else {
                      panel.classList.add('hidden');
                      if (btn) btn.textContent = 'Развернуть';
                    }
                  }
                };

                window.__resetSession = function() {
                  if (confirm('Сбросить сохраненный токен и профиль?')) {
                    try {
                      localStorage.removeItem('token');
                      localStorage.removeItem('user');
                      localStorage.removeItem('e2e_private_key');
                    } catch(e) {}
                    window.location.href = '/login';
                  }
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

                var path = window.location.pathname || '';
                var isRoot = path === '/' || path === '';
                var token = null;
                var user = null;
                try {
                  token = localStorage.getItem('token');
                  user = localStorage.getItem('user');
                } catch(e) {
                  console.warn('⚠️ [Boot 2/5] Ошибка чтения localStorage:', e.message);
                }

                console.log('🚀 [Boot 1/5] HTML получен браузером. Путь: ' + path);
                console.log('🔑 [Boot 2/5] Проверка localStorage: token=' + (token ? 'ЕСТЬ' : 'НЕТ') + ', user=' + (user ? 'ЕСТЬ' : 'НЕТ'));

                if (isRoot && !token) {
                  console.log('🔀 [Boot] Сессия не найдена, ранний переход на /login...');
                  window.location.replace('/login');
                  return;
                }

                var chunkRetries = {};
                function retryScriptTag(src) {
                  if (!src) return;
                  chunkRetries[src] = (chunkRetries[src] || 0) + 1;
                  var attempt = chunkRetries[src];
                  if (attempt > 3) {
                    console.warn('❌ [Чанк] Превышен лимит повторов (' + attempt + '): ' + src);
                    var netHint = document.getElementById('zaychat-net-hint');
                    if (netHint) netHint.classList.remove('hidden');
                    return;
                  }
                  var scriptName = src.split('/').pop().split('?')[0];
                  console.log('🔄 [Авто-повтор] Загрузка чанка (' + attempt + '/3): ' + scriptName);
                  updateStep('step-scripts', 'Повтор: ' + scriptName + ' (' + attempt + ') 🔄', 'text-amber-400 font-medium', 'w-2 h-2 rounded-full bg-amber-500 animate-pulse');
                  
                  var delay = attempt === 1 ? 400 : attempt * 1000;
                  setTimeout(function() {
                    var s = document.createElement('script');
                    var sep = src.indexOf('?') === -1 ? '?' : '&';
                    s.src = src + sep + '_retry=' + attempt + '_' + Date.now();
                    s.async = false;
                    s.defer = true;
                    s.onload = function() {
                      console.log('✅ [Авто-повтор успешен] Чанк загружен: ' + scriptName);
                      updateStep('step-scripts', 'Чанк восстановлен ✅', 'text-emerald-400 font-medium', 'w-2 h-2 rounded-full bg-emerald-500');
                    };
                    s.onerror = function() {
                      console.warn('⚠️ [Авто-повтор сбой] Чанк: ' + scriptName + ' (попытка ' + attempt + ')');
                      retryScriptTag(src);
                    };
                    document.head.appendChild(s);
                  }, delay);
                }

                var linkRetryAttempts = {};
                function retryLinkTag(href) {
                  var attempt = (linkRetryAttempts[href] || 0) + 1;
                  linkRetryAttempts[href] = attempt;
                  if (attempt > 3) return;
                  var linkName = href.split('/').pop().split('?')[0];
                  console.log('🔄 [Авто-повтор] Загрузка стилей (' + attempt + '/3): ' + linkName);
                  setTimeout(function() {
                    var l = document.createElement('link');
                    l.rel = 'stylesheet';
                    var sep = href.indexOf('?') === -1 ? '?' : '&';
                    l.href = href + sep + '_retry=' + attempt + '_' + Date.now();
                    l.onload = function() {
                      console.log('✅ [Авто-повтор успешен] Стили загружены: ' + linkName);
                    };
                    l.onerror = function() {
                      retryLinkTag(href);
                    };
                    document.head.appendChild(l);
                  }, attempt === 1 ? 300 : attempt * 800);
                }

                // Global error listener
                window.addEventListener('error', function(e) {
                  var t = e.target || e.srcElement;
                  if (t && t.tagName === 'SCRIPT' && t.src) {
                    var scriptName = t.src.split('/').pop().split('?')[0];
                    console.warn('⚠️ [Скрипт] Ошибка загрузки чанка сети: ' + scriptName);
                    updateStep('step-scripts', 'Сбой сети (' + scriptName + ') ⚠️', 'text-amber-400 font-medium', 'w-2 h-2 rounded-full bg-amber-500');
                    var netHint = document.getElementById('zaychat-net-hint');
                    if (netHint) netHint.classList.remove('hidden');
                    retryScriptTag(t.src);
                  } else if (t && t.tagName === 'LINK' && t.href && (t.rel === 'stylesheet' || t.as === 'style')) {
                    var cssName = t.href.split('/').pop().split('?')[0];
                    console.warn('⚠️ [Стили] Ошибка загрузки CSS сети: ' + cssName);
                    retryLinkTag(t.href);
                  } else {
                    var rawMsg = (e.message || '');
                    if (rawMsg && rawMsg !== 'Unknown error' && rawMsg !== 'Script error.' && rawMsg.indexOf('hydration') === -1 && rawMsg.indexOf('Hydration') === -1) {
                      var errMsg = '❌ [Window Error] ' + rawMsg + (e.filename ? ' at ' + e.filename + ':' + (e.lineno || '') : '');
                      window.__addZayChatLog('error', errMsg);
                      origErr.call(console, errMsg);
                    }
                  }
                }, true);

                window.addEventListener('unhandledrejection', function(e) {
                  var rejReason = e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'Promise rejected';
                  if (rejReason.indexOf('hydration') === -1 && rejReason.indexOf('Hydration') === -1) {
                    var rejMsg = '❌ [Unhandled Promise] ' + rejReason;
                    window.__addZayChatLog('error', rejMsg);
                    origErr.call(console, rejMsg);
                    if (rejReason.indexOf('Loading chunk') !== -1 || rejReason.indexOf('ChunkLoadError') !== -1) {
                      var netHint = document.getElementById('zaychat-net-hint');
                      if (netHint) netHint.classList.remove('hidden');
                    }
                  }
                });

                // Network online/offline handlers
                window.addEventListener('online', function() {
                  console.log('📶 [Сеть] Подключение к интернету восстановлено.');
                  updateStep('step-scripts', 'Сеть активна. Обновление...', 'text-emerald-400 font-medium', 'w-2 h-2 rounded-full bg-emerald-500');
                  var netHint = document.getElementById('zaychat-net-hint');
                  if (netHint) netHint.classList.add('hidden');
                });

                window.addEventListener('offline', function() {
                  console.warn('⚠️ [Сеть] Нет подключения к интернету.');
                  updateStep('step-scripts', 'Офлайн (нет сети) ❌', 'text-rose-400 font-medium', 'w-2 h-2 rounded-full bg-rose-500');
                  var netHint = document.getElementById('zaychat-net-hint');
                  if (netHint) netHint.classList.remove('hidden');
                });

                var totalScripts = 14;

                document.addEventListener('DOMContentLoaded', function() {
                  console.log('📄 [Boot 3/5] DOMContentLoaded - базовый DOM готов.');
                  updateStep('step-html', 'Готово ✅', 'text-emerald-400 font-medium');

                  var scriptsInDom = document.querySelectorAll('script[src*="/_next/static/"]');
                  if (scriptsInDom.length > 0) {
                    totalScripts = scriptsInDom.length;
                  }

                  try {
                    var tok = localStorage.getItem('token');
                    if (tok) {
                      updateStep('step-session', 'Сессия найдена ✅', 'text-emerald-400 font-medium', 'w-2 h-2 rounded-full bg-emerald-500');
                    } else {
                      updateStep('step-session', 'Токен отсутствует 👤', 'text-neutral-400 font-medium', 'w-2 h-2 rounded-full bg-neutral-500');
                    }
                  } catch(e) {}

                  // Check Service Workers
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(regs) {
                      if (regs && regs.length > 0) {
                        console.log('👷 [Service Worker] Активных воркеров: ' + regs.length);
                      }
                    }).catch(function() {});
                  }

                  // Observe chunk loading via PerformanceObserver
                  if (window.PerformanceObserver) {
                    try {
                      var obs = new PerformanceObserver(function(list) {
                        list.getEntries().forEach(function(entry) {
                          if (entry.initiatorType === 'script' || (entry.name && entry.name.indexOf('/_next/static/') !== -1)) {
                            loadedChunksCount++;
                            var name = entry.name.split('/').pop().split('?')[0];
                            var sizeKb = entry.transferSize ? Math.round(entry.transferSize / 1024) + ' KB' : (entry.encodedBodySize ? Math.round(entry.encodedBodySize / 1024) + ' KB' : '');
                            var dur = Math.round(entry.duration);
                            console.log('📦 [Чанк ' + loadedChunksCount + '] ' + name + (sizeKb ? ' (' + sizeKb + ')' : '') + ' за ' + dur + 'мс');
                            var pct = Math.min(99, Math.round((loadedChunksCount / totalScripts) * 100));
                            updateStep('step-scripts', loadedChunksCount + ' из ' + totalScripts + ' (' + pct + '%)', 'text-indigo-400 font-medium', 'w-2 h-2 rounded-full bg-indigo-500 animate-pulse');
                            updateStep('step-app', 'Ожидание модулей (' + pct + '%)', 'text-neutral-400 font-medium text-[11px]', 'w-2 h-2 rounded-full bg-neutral-600');
                          }
                        });
                      });
                      obs.observe({ entryTypes: ['resource'] });
                    } catch(e) {}
                  }

                  // Populate existing logs into DOM if terminal exists
                  window.__ZAYCHAT_LOGS.forEach(function(entry) {
                    appendLiveLog(entry);
                  });

                  // Slow connection hint after 5 seconds
                  setTimeout(function() {
                    var appStatus = document.getElementById('step-app-status');
                    if (appStatus && appStatus.textContent.indexOf('Готово') === -1) {
                      var slowHint = document.getElementById('zaychat-slow-hint');
                      if (slowHint) slowHint.classList.remove('hidden');
                    }
                  }, 5000);
                });

                window.addEventListener('load', function() {
                  console.log('🌐 [Boot 4/5] Window Loaded - все ресурсы страницы загружены.');
                  updateStep('step-scripts', 'Все модули загружены ✅', 'text-emerald-400 font-medium', 'w-2 h-2 rounded-full bg-emerald-500');
                  updateStep('step-app', 'Запуск React... ⏳', 'text-amber-400 font-medium', 'w-2 h-2 rounded-full bg-amber-500 animate-pulse');

                  // Safety timeout: If React hasn't dismissed splash screen after 5 seconds
                  setTimeout(function() {
                    var splash = document.getElementById('zaychat-boot-splash');
                    if (splash && (!splash.style.opacity || splash.style.opacity !== '0')) {
                      console.warn('⚠️ [Boot] Задержка запуска интерфейса.');
                      var slowHint = document.getElementById('zaychat-slow-hint');
                      if (slowHint) slowHint.classList.remove('hidden');
                    }
                  }, 5000);
                });
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased overflow-hidden">
        {/* Instant SSR Splash Screen with 0 hydration interference */}
        <div 
          id="zaychat-boot-splash"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: BOOT_SPLASH_HTML }}
        />
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
