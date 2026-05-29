import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Message } from '@/types/chat';

interface ChatDBSchema extends DBSchema {
  chat_cache: {
    key: string;
    value: {
      chatId: string;
      messages: Message[];
      updatedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<ChatDBSchema>> | null = null;

function getDb() {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<ChatDBSchema>('zstate-chat-db', 4, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('chat_cache')) {
          db.createObjectStore('chat_cache', { keyPath: 'chatId' });
        } else if (oldVersion < 4) {
          db.deleteObjectStore('chat_cache');
          db.createObjectStore('chat_cache', { keyPath: 'chatId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getCachedMessages(chatId: string): Promise<Message[] | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const data = await db.get('chat_cache', chatId);
    return data ? data.messages : null;
  } catch (error) {
    console.error('Failed to get cached messages:', error);
    return null;
  }
}

export async function setCachedMessages(chatId: string, messages: Message[]) {
  try {
    const db = await getDb();
    if (!db) return;
    
    // IMPORTANT: We cache messages AS IS (including plain text and is_decrypted: true)
    // Decrypting messages takes a lot of time on each load. For performance reasons, 
    // we keep the decrypted messages in IndexedDB cache so the feed loads instantly.
    // If you ever need to change this back to encrypting cache, remember that it causes
    // a delay of a few seconds every time.
    await db.put('chat_cache', {
      chatId,
      messages,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Failed to cache messages:', error);
  }
}

export async function clearCache() {
  try {
    const db = await getDb();
    if (!db) return;
    await db.clear('chat_cache');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}
