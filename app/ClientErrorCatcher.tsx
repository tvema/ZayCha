'use client';
import { useEffect, useState } from 'react';

function isIgnoredError(raw: any): boolean {
  if (!raw) return true;
  const str = String(raw?.stack || raw?.message || raw || '').toLowerCase();
  // Hydration mismatches are gracefully recovered by React and must not crash the app
  if (
    str.includes('hydration') ||
    str.includes('hydrat') ||
    str.includes('mismatch') ||
    str.includes('minified react error #418') ||
    str.includes('minified react error #423') ||
    str.includes('minified react error #425')
  ) {
    return true;
  }
  // Script load / network retries are handled by retry logic and must not crash the app
  if (
    str.includes('script error') ||
    str.includes('loading chunk') ||
    str.includes('failed to fetch') ||
    str.includes('chunkloaderror') ||
    str.includes('net::err') ||
    str.includes('networkerror') ||
    str.includes("expected expression, got '<'") ||
    str.includes("unexpected token '<'") ||
    str.includes("syntaxerror: expected expression") ||
    str.includes("syntaxerror: unexpected token")
  ) {
    return true;
  }
  return false;
}

export function ClientErrorCatcher({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleWindowError = (e: ErrorEvent) => {
      if (isIgnoredError(e.error) || isIgnoredError(e.message)) {
        console.warn('⚠️ [Recoverable Client Warning] Игнорировано:', e.error || e.message);
        return;
      }
      console.error('Caught via window.onerror:', e.error);
      setError(e.error ? (e.error.stack || e.error.message) : e.message);
    };

    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      if (isIgnoredError(e.reason)) {
        console.warn('⚠️ [Recoverable Promise Rejection] Игнорировано:', e.reason);
        return;
      }
      console.error('Caught via unhandledrejection:', e.reason);
      setError(e.reason ? (e.reason.stack || e.reason.message) : 'Promise Rejection');
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 bg-neutral-950 text-neutral-100 z-50 flex flex-col items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-lg w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl font-bold">
              ⚠️
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Внимание: ошибка в приложении</h2>
              <p className="text-xs text-neutral-400">Произошел непредвиденный сбой интерфейса</p>
            </div>
          </div>

          <pre className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl text-xs text-rose-300 font-mono max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
            {error}
          </pre>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-800">
            <button
              onClick={() => setError(null)}
              type="button"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Продолжить работу
            </button>
            <button
              onClick={() => window.location.reload()}
              type="button"
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Перезагрузить страницу
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  localStorage.removeItem('e2e_private_key');
                } catch(e) {}
                window.location.href = '/login';
              }}
              type="button"
              className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Сбросить сессию
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
