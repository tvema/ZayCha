import { useState, useRef, useCallback } from 'react';
import { User, Message } from '@/types/chat';
import { useChatStore } from '@/store/chatStore';
import { ApiClient } from '@/lib/api';

export function useChatSearch() {
  const token = useChatStore(s => s.token);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [messageSearchResults, setMessageSearchResults] = useState<{ chatId: string, message: Message, isGroup: boolean }[]>([]);
  const backgroundSearchRef = useRef<{ q: string; active: boolean }>({ q: '', active: false });

  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [isInChatSearching, setIsInChatSearching] = useState(false);
  const inChatSearchRef = useRef<{ q: string; chatId: string | null; active: boolean }>({ q: '', chatId: null, active: false });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    if (!token) return;
    try {
      const res = await ApiClient.get(`/api/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res);
    } catch (err) {
      console.warn('Search API failure', err);
    }
  }, [token]);

  const searchMessages = useCallback(async (q: string, chatId?: string | null) => {
    if (!token) return [];
    try {
      const url = chatId ? `/api/search?q=${encodeURIComponent(q)}&chatId=${chatId}` : `/api/search?q=${encodeURIComponent(q)}`;
      const data = await ApiClient.get(url);
      return data;
    } catch (err) {
      console.warn('Message search failure', err);
      return [];
    }
  }, [token]);

  return {
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    isSearching, setIsSearching,
    messageSearchResults, setMessageSearchResults,
    backgroundSearchRef,
    inChatSearchQuery, setInChatSearchQuery,
    isInChatSearching, setIsInChatSearching,
    inChatSearchRef,
    isSearchOpen, setIsSearchOpen,
    highlightedMessageId, setHighlightedMessageId,
    searchUsers, searchMessages
  };
}
