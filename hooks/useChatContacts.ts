import { useCallback } from 'react';
import { User, Group } from '@/types/chat';
import { useGlobalModal } from '@/components/GlobalModalProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { importKey, encryptAESKeyWithRSA } from '@/lib/crypto';
import { keyRing } from '@/lib/keyRing';
import { safeLocalStorage } from '@/lib/safeStorage';
import { Socket } from 'socket.io-client';

export function useChatContacts(
  token: string | null,
  contacts: User[],
  groups: Group[],
  activeContact: User | null,
  activeGroup: Group | null,
  contactCircles: any[],
  setContacts: any,
  setGroups: any,
  setActiveContact: any,
  setActiveGroup: any,
  setMessages: any,
  setSearchQuery: any,
  setIsSearching: any,
  fetchContacts: any,
  fetchGroups: any,
  fetchContactCircles: any,
  socket: Socket | null,
  modals: any
) {
  const { showAlert, showConfirm } = useGlobalModal();
  const { t } = useLanguage();

  const handleRemoveContact = useCallback(async (contactId: string) => {
    showConfirm({
      message: t('common.removeContactConfirm') || 'Are you sure you want to remove this contact?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/contacts/${contactId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchContacts();
            fetchContactCircles();
            if (activeContact?.id === contactId) {
              setActiveContact(null);
            }
          }
        } catch (err) {
          console.warn('Failed to remove contact', err);
        }
      }
    });
  }, [token, fetchContacts, fetchContactCircles, activeContact, showConfirm, t]);

  const handleLeaveGroup = useCallback(async (groupId: string) => {
    showConfirm({
      message: 'Вы уверены, что хотите покинуть группу?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/groups/${groupId}/leave`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            fetchGroups();
            if (activeGroup?.id === groupId) {
              setActiveGroup(null);
            }
            if (socket) {
              socket.emit('leaveRoom', `group_${groupId}`);
              socket.emit('roomEvent', { roomId: `group_${groupId}`, type: 'memberLeft' });
            }
          }
        } catch (err) {
          console.warn('Failed to leave group:', err);
        }
      }
    });
  }, [token, fetchGroups, activeGroup, socket, showConfirm]);

  const handleClearChat = useCallback(async (contactId: string, isGroup: boolean = false) => {
    showConfirm({
      message: t('common.clearChatConfirm') || 'Are you sure you want to clear this chat?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/messages/${contactId}/clear?isGroup=${isGroup}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            setMessages((prev: any[]) => prev.filter(msg => 
              isGroup ? msg.group_id !== contactId : 
              (msg.sender_id !== contactId && msg.receiver_id !== contactId)
            ));
          }
        } catch (err) {
          console.warn('Failed to clear chat:', err);
        }
      }
    });
  }, [token, showConfirm, t, setMessages]);

  const handleMoveContactToCircle = async (contactId: string, toCircleType: 'normal' | 'dnd' | 'blacklist') => {
    try {
      const res = await fetch(`/api/contacts/${contactId}/circle`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ circle_type: toCircleType })
      });
      if (res.ok) {
        fetchContacts();
      }
    } catch (error) {
      console.warn('Error moving contact to circle type:', error);
    }
  };

  const handleAddUserToGroup = async (userId: string, groupId: string, targetUser?: User) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (group && group.encrypted_keys && targetUser && !targetUser.public_key) {
        alert('Cannot add user: they need to log in to generate encryption keys first.');
        return;
      }

      let encryptedKeysForNewUser: Record<string, string> | null = null;
      
      if (group && group.encrypted_keys && targetUser?.public_key) {
        try {
          let keysObj: Record<string, string>;
          try {
            keysObj = JSON.parse(group.encrypted_keys);
          } catch (e) {
            keysObj = { "1": group.encrypted_keys };
          }
          const privateKeyJwk = safeLocalStorage.getItem('e2e_private_key');
          
          if (privateKeyJwk) {
            const targetPublicKey = await importKey(targetUser.public_key, 'public');
            encryptedKeysForNewUser = {};
            
            for (const [version, encryptedGroupKey] of Object.entries(keysObj)) {
              try {
                const groupAesKey = await keyRing.getAesKey(encryptedGroupKey as string);
                if (groupAesKey) {
                  const encryptedKeyForNewUser = await encryptAESKeyWithRSA(groupAesKey, targetPublicKey);
                  encryptedKeysForNewUser[version] = encryptedKeyForNewUser;
                }
              } catch (e) {
                console.warn(`Failed to encrypt group key version ${version} for new member`, e);
              }
            }
            
            if (Object.keys(encryptedKeysForNewUser).length === 0) {
              encryptedKeysForNewUser = null;
            }
          }
        } catch (e) {
          console.warn("Failed to process group keys for new member", e);
        }
      }

      const response = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          userId,
          encrypted_keys: encryptedKeysForNewUser
        })
      });
      if (response.ok) {
        modals.setShowAddToGroupModal(false);
      } else {
        const data = await response.json();
        showAlert(data.error || 'Failed to add user to group');
      }
    } catch (err) {
      console.warn('Error adding user to group:', err);
    }
  };

  const handleAddContact = async (contactId: string) => {
    if (!token) return;
    try {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ contactId })
      });
      
      const res = await fetch('/api/contacts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const text = await res.text();
        const updatedContacts = text ? JSON.parse(text) : [];
        setContacts(updatedContacts);
        
        const activatedContact = updatedContacts.find((c: any) => c.id === contactId);
        if (activatedContact) {
          setActiveContact(activatedContact);
          setActiveGroup(null);
          window.history.pushState({ chatOpen: true }, '', '#chat');
        }
      }
      setSearchQuery('');
      setIsSearching(false);
    } catch (err) {
      console.warn('Failed to add contact:', err);
    }
  };

  const handleBlockContact = async (contactId: string) => {
    if (!token) return;
    try {
      let blacklistCircle = contactCircles.find(c => c.is_blacklist === 1);
      
      if (!blacklistCircle) {
        const res = await fetch('/api/contact-circles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: 'Blacklist',
            do_not_disturb: true,
            is_hidden: false,
            is_blacklist: true
          })
        });
        if (res.ok) {
          blacklistCircle = await res.json();
          fetchContactCircles();
        }
      }

      if (blacklistCircle) {
        await fetch(`/api/contact-circles/${blacklistCircle.id}/members`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ contactId })
        });
        fetchContactCircles();
        
        await fetch(`/api/contacts/${contactId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchContacts();
        
        if (activeContact?.id === contactId) {
          setActiveContact(null);
          window.history.pushState({ chatOpen: false }, '', '#');
        }
      }
    } catch (err) {
      console.warn('Failed to block contact:', err);
    }
  };

  return {
    handleRemoveContact,
    handleLeaveGroup,
    handleClearChat,
    handleMoveContactToCircle,
    handleAddUserToGroup,
    handleAddContact,
    handleBlockContact
  };
}
