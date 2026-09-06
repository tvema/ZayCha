'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Copy, Check, RefreshCw, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import { safeLocalStorage } from '@/lib/safeStorage';

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  msg: string;
}

export function DiagnosticTerminal({ onForceEnter }: { onForceEnter?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const updateLogs = () => {
      if (typeof window !== 'undefined' && (window as any).__ZAYCHAT_LOGS) {
        setLogs([...(window as any).__ZAYCHAT_LOGS]);
      }
    };

    updateLogs();

    const handleNewLog = () => {
      updateLogs();
    };

    window.addEventListener('zaychat:new_log', handleNewLog);
    const interval = setInterval(updateLogs, 400);

    return () => {
      window.removeEventListener('zaychat:new_log', handleNewLog);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (expanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, expanded]);

  const handleCopy = () => {
    if (typeof window !== 'undefined' && (window as any).__copyLogs) {
      (window as any).__copyLogs();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    const text = logs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.warn('Clipboard write failed:', err);
    });
  };

  const handleResetSession = () => {
    if (typeof window !== 'undefined' && (window as any).__resetSession) {
      (window as any).__resetSession();
      return;
    }
    safeLocalStorage.removeItem('token');
    safeLocalStorage.removeItem('user');
    safeLocalStorage.removeItem('e2e_private_key');
    window.location.href = '/login';
  };

  return (
    <div className="w-full max-w-md mx-auto mt-4 px-3" suppressHydrationWarning>
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div 
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).__toggleZayLogs) {
              (window as any).__toggleZayLogs();
            }
            setExpanded(!expanded);
          }}
          className="flex items-center justify-between px-3 py-2 bg-neutral-800/60 hover:bg-neutral-800 cursor-pointer transition-colors select-none"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-mono font-medium text-neutral-300">
              Журнал загрузки (<span id="zaychat-log-counter">{logs.length}</span>)
            </span>
          </div>
          <div className="flex items-center gap-1 text-neutral-400">
            <span id="zaychat-log-toggle-btn" className="text-[10px] uppercase font-mono text-neutral-500 mr-1">
              {expanded ? 'Свернуть' : 'Развернуть'}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* Latest log preview when collapsed */}
        {!expanded && logs.length > 0 && (
          <div 
            onClick={() => setExpanded(true)}
            className="px-3 py-2 text-[11px] font-mono text-neutral-400 truncate cursor-pointer bg-neutral-950/50 hover:text-neutral-300"
          >
            <span id="zaychat-log-preview">
              <span className="text-neutral-500 mr-1.5">[{logs[logs.length - 1]?.time}]</span>
              <span className={
                logs[logs.length - 1]?.level === 'error' ? 'text-rose-400' :
                logs[logs.length - 1]?.level === 'warn' ? 'text-amber-400' : 'text-neutral-300'
              }>
                {logs[logs.length - 1]?.msg}
              </span>
            </span>
          </div>
        )}

        {/* Full Terminal View */}
        <div id="zaychat-live-log-container" className={`${expanded ? '' : 'hidden'} p-3 bg-neutral-950/90`} suppressHydrationWarning>
          <div 
            id="zaychat-live-logs" 
            className="h-44 overflow-y-auto space-y-1 text-[11px] font-mono scrollbar-thin scrollbar-thumb-neutral-700" 
            suppressHydrationWarning
          >
            {logs.length === 0 ? (
              <div className="text-neutral-500 text-center py-6 text-xs animate-pulse">
                Инициализация журнала загрузки...
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-1.5 leading-relaxed break-words py-0.5 border-b border-neutral-900/60">
                  <span className="text-neutral-600 shrink-0 select-none text-[10px]">[{log.time}]</span>
                  <span className={`shrink-0 text-[10px] font-bold ${
                    log.level === 'error' ? 'text-rose-400' :
                    log.level === 'warn' ? 'text-amber-400' : 'text-indigo-400'
                  }`}>
                    {log.level === 'error' ? 'ERR' : log.level === 'warn' ? 'WRN' : 'INF'}
                  </span>
                  <span className={`flex-1 text-[11px] ${
                    log.level === 'error' ? 'text-rose-300' :
                    log.level === 'warn' ? 'text-amber-200' : 'text-neutral-300'
                  }`}>
                    {log.msg}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>

          {/* Action buttons inside terminal */}
          <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-neutral-800 text-xs">
            <button
              onClick={handleCopy}
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано!' : 'Копировать лог'}</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => window.location.reload()}
                type="button"
                className="flex items-center gap-1 px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                title="Обновить страницу"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {onForceEnter && (
                <button
                  onClick={onForceEnter}
                  type="button"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <span>Войти</span>
                </button>
              )}
              <button
                onClick={handleResetSession}
                type="button"
                className="flex items-center gap-1 px-2 py-1.5 bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                title="Сбросить сессию"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
