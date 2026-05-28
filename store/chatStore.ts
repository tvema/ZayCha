import { create } from 'zustand';
import { User, Group, Message } from '@/types/chat';

interface ChatState {
  user: User | null;
  token: string | null;
  contacts: User[];
  groups: Group[];
  contactCircles: any[];
  unlockedCircles: string[];
  
  activeContact: User | null;
  activeGroup: Group | null;
  sidebarView: 'chats' | 'groups';
  
  messages: Message[];
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  replyingTo: Message | null;
  editingMessage: Message | null;
  
  feedPosts: any[];
  hasUnreadFeed: boolean;
  appView: 'messages' | 'feed';
  
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setContacts: (contacts: User[] | ((prev: User[]) => User[])) => void;
  setGroups: (groups: Group[] | ((prev: Group[]) => Group[])) => void;
  setContactCircles: (circles: any[]) => void;
  setUnlockedCircles: (circles: string[]) => void;
  
  setActiveContact: (contact: User | null) => void;
  setActiveGroup: (group: Group | null) => void;
  setSidebarView: (view: 'chats' | 'groups') => void;
  
  setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void;
  setHasMoreMessages: (hasMore: boolean) => void;
  setIsLoadingMore: (isLoading: boolean) => void;
  setReplyingTo: (msg: Message | null) => void;
  setEditingMessage: (msg: Message | null) => void;
  
  setFeedPosts: (posts: any[] | ((prev: any[]) => any[])) => void;
  setHasUnreadFeed: (hasUnread: boolean) => void;
  setAppView: (view: 'messages' | 'feed') => void;
}

export const useChatStore = create<ChatState>((set) => ({
  user: null,
  token: null,
  contacts: [],
  groups: [],
  contactCircles: [],
  unlockedCircles: [],
  
  activeContact: null,
  activeGroup: null,
  sidebarView: 'chats',
  
  messages: [],
  hasMoreMessages: true,
  isLoadingMore: false,
  replyingTo: null,
  editingMessage: null,
  
  feedPosts: [],
  hasUnreadFeed: false,
  appView: 'messages',
  
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setContacts: (updater) => set((state) => ({ contacts: typeof updater === 'function' ? updater(state.contacts) : updater })),
  setGroups: (updater) => set((state) => ({ groups: typeof updater === 'function' ? updater(state.groups) : updater })),
  setContactCircles: (contactCircles) => set({ contactCircles }),
  setUnlockedCircles: (unlockedCircles) => set({ unlockedCircles }),
  
  setActiveContact: (activeContact) => set({ activeContact }),
  setActiveGroup: (activeGroup) => set({ activeGroup }),
  setSidebarView: (sidebarView) => set({ sidebarView }),
  
  setMessages: (updater) => set((state) => ({ 
    messages: typeof updater === 'function' ? updater(state.messages) : updater 
  })),
  setHasMoreMessages: (hasMoreMessages) => set({ hasMoreMessages }),
  setIsLoadingMore: (isLoadingMore) => set({ isLoadingMore }),
  setReplyingTo: (replyingTo) => set({ replyingTo }),
  setEditingMessage: (editingMessage) => set({ editingMessage }),
  
  setFeedPosts: (updater) => set((state) => ({
    feedPosts: typeof updater === 'function' ? updater(state.feedPosts) : updater
  })),
  setHasUnreadFeed: (hasUnreadFeed) => set({ hasUnreadFeed }),
  setAppView: (appView) => set({ appView })
}));
