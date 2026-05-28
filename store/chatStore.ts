import { create } from 'zustand';
import { User, Group, Message } from '@/types/chat';

type Setter<T> = (updater: T | ((prev: T) => T)) => void;

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
  
  setUser: Setter<User | null>;
  setToken: Setter<string | null>;
  setContacts: Setter<User[]>;
  setGroups: Setter<Group[]>;
  setContactCircles: Setter<any[]>;
  setUnlockedCircles: Setter<string[]>;
  
  setActiveContact: Setter<User | null>;
  setActiveGroup: Setter<Group | null>;
  setSidebarView: Setter<'chats' | 'groups'>;
  
  setMessages: Setter<Message[]>;
  setHasMoreMessages: Setter<boolean>;
  setIsLoadingMore: Setter<boolean>;
  setReplyingTo: Setter<Message | null>;
  setEditingMessage: Setter<Message | null>;
  
  setFeedPosts: Setter<any[]>;
  setHasUnreadFeed: Setter<boolean>;
  setAppView: Setter<'messages' | 'feed'>;
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
  
  setUser: (updater) => set((state) => ({ user: typeof updater === 'function' ? (updater as any)(state.user) : updater })),
  setToken: (updater) => set((state) => ({ token: typeof updater === 'function' ? (updater as any)(state.token) : updater })),
  setContacts: (updater) => set((state) => ({ contacts: typeof updater === 'function' ? (updater as any)(state.contacts) : updater })),
  setGroups: (updater) => set((state) => ({ groups: typeof updater === 'function' ? (updater as any)(state.groups) : updater })),
  setContactCircles: (updater) => set((state) => ({ contactCircles: typeof updater === 'function' ? (updater as any)(state.contactCircles) : updater })),
  setUnlockedCircles: (updater) => set((state) => ({ unlockedCircles: typeof updater === 'function' ? (updater as any)(state.unlockedCircles) : updater })),
  
  setActiveContact: (updater) => set((state) => ({ activeContact: typeof updater === 'function' ? (updater as any)(state.activeContact) : updater })),
  setActiveGroup: (updater) => set((state) => ({ activeGroup: typeof updater === 'function' ? (updater as any)(state.activeGroup) : updater })),
  setSidebarView: (updater) => set((state) => ({ sidebarView: typeof updater === 'function' ? (updater as any)(state.sidebarView) : updater })),
  
  setMessages: (updater) => set((state) => ({ messages: typeof updater === 'function' ? (updater as any)(state.messages) : updater })),
  setHasMoreMessages: (updater) => set((state) => ({ hasMoreMessages: typeof updater === 'function' ? (updater as any)(state.hasMoreMessages) : updater })),
  setIsLoadingMore: (updater) => set((state) => ({ isLoadingMore: typeof updater === 'function' ? (updater as any)(state.isLoadingMore) : updater })),
  setReplyingTo: (updater) => set((state) => ({ replyingTo: typeof updater === 'function' ? (updater as any)(state.replyingTo) : updater })),
  setEditingMessage: (updater) => set((state) => ({ editingMessage: typeof updater === 'function' ? (updater as any)(state.editingMessage) : updater })),
  
  setFeedPosts: (updater) => set((state) => ({ feedPosts: typeof updater === 'function' ? (updater as any)(state.feedPosts) : updater })),
  setHasUnreadFeed: (updater) => set((state) => ({ hasUnreadFeed: typeof updater === 'function' ? (updater as any)(state.hasUnreadFeed) : updater })),
  setAppView: (updater) => set((state) => ({ appView: typeof updater === 'function' ? (updater as any)(state.appView) : updater }))
}));