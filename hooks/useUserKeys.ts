import { useEffect } from 'react';
import { useChatStore } from '@/store/chatStore';
import { keyRing } from '@/lib/keyRing';
import { generateRSAKeyPair, exportKey, encryptPrivateKeyWithPassword } from '@/lib/crypto';
import { ApiClient } from '@/lib/api';

export function useUserKeys() {
  const token = useChatStore(s => s.token);
  const user = useChatStore(s => s.user);

  // Eagerly hydrate IndexedDB with private key for SW decryption
  useEffect(() => {
    if (typeof window !== 'undefined') {
      keyRing.getPrivateKey().catch(console.warn);
    }
  }, []);

  // Automatic Key Generation for old users
  useEffect(() => {
    let active = true;
    const generateKeysIfMissing = async () => {
      if (!token || !user) return;
      if (user.public_key || user.encrypted_private_key) return; // Already has keys
      if (user.status !== 'active') return;

      try {
        const res = await ApiClient.get('/api/users/keys');
        const hasKeys = res?.hasKeys;
        if (hasKeys || !active) return;

        const password = String(Date.now() + Math.random());
        const keyPair = await generateRSAKeyPair();
        const publicKeyString = await exportKey(keyPair.publicKey);
        const encryptedPrivateKeyString = await encryptPrivateKeyWithPassword(keyPair.privateKey, password);

        await ApiClient.post('/api/users/keys', {
          publicKey: publicKeyString,
          encryptedPrivateKey: encryptedPrivateKeyString
        });

        await keyRing.setPrivateKey(keyPair.privateKey);
      } catch (e) {
        console.warn('[E2EE] Error during automatic key generation:', e);
      }
    };
    generateKeysIfMissing();
    return () => { active = false; };
  }, [token, user]);
}
