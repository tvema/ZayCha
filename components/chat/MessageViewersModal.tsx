import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { useLanguage } from '@/components/LanguageProvider';

interface MessageViewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
}

interface Viewer {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  read_at: string;
}

export function MessageViewersModal({ isOpen, onClose, messageId }: MessageViewersModalProps) {
  const { t } = useLanguage();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && messageId) {
      loadViewers();
    } else {
      setViewers([]);
    }
  }, [isOpen, messageId]);

  const loadViewers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/messages/${messageId}/reads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleString([], {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="viewers-modal"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)', pointerEvents: 'none' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          onClick={onClose}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20, pointerEvents: 'none' }}
            className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-indigo-500" />
                Просмотревшие
              </h3>
              <button 
                onClick={onClose}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto no-scrollbar">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : viewers.length === 0 ? (
                <div className="text-center p-8 text-neutral-500 dark:text-neutral-400">
                  Пока никто не просмотрел
                </div>
              ) : (
                <div className="space-y-3">
                  {viewers.map(v => (
                    <div key={v.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0">
                        {v.avatar_url ? (
                          <Image src={v.avatar_url} alt={v.username} width={40} height={40} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-neutral-500 dark:text-neutral-400">
                            {v.first_name ? v.first_name.charAt(0).toUpperCase() : v.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {v.first_name} {v.last_name}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                          @{v.username}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                        {formatDate(v.read_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
