import { useState, useRef, useCallback } from 'react';
import { User, Group } from '@/types/chat';
import { useGlobalModal } from '@/components/GlobalModalProvider';
import { useLanguage } from '@/components/LanguageProvider';
import { safeLocalStorage } from '@/lib/safeStorage';
import { importKey, encryptPrivateKeyWithPassword } from '@/lib/crypto';

export function useChatProfile(
  user: User | null,
  setUser: (user: User | null) => void,
  token: string | null,
  activeGroup: Group | null,
  setActiveGroup: any,
  setGroups: any
) {
  const { showAlert } = useGlobalModal();
  const { t } = useLanguage();
  
  const [avatarToCrop, setAvatarToCrop] = useState<string | null>(null);
  const avatarTargetRef = useRef<{ type: 'user' | 'group', id?: string }>({ type: 'user' });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = useCallback((typeOrEvent: any = 'user', id?: string) => {
    const isEvent = typeOrEvent && (typeof typeOrEvent === 'object' && ('nativeEvent' in typeOrEvent || 'target' in typeOrEvent));
    const resolvedType = (typeof typeOrEvent === 'string' && !isEvent) ? typeOrEvent : 'user';
    const resolvedId = (typeof typeOrEvent === 'string' && !isEvent) ? id : undefined;

    avatarTargetRef.current = { type: resolvedType as 'user' | 'group', id: resolvedId };
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  }, []);

  const handleCropComplete = useCallback(async (croppedBlob: Blob) => {
    try {
      const target = avatarTargetRef.current;
      const endpoint = target.type === 'group' && target.id 
        ? `/api/groups/${target.id}/avatar` 
        : `/api/users/avatar`;
      
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'avatar.jpg');
        
      const res = await fetch(endpoint, {
        method: target.type === 'group' ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) {
        let errMsg = `Upload failed: ${res.status}`;
        try { errMsg += ` - ${await res.text()}`; } catch (e) {}
        throw new Error(errMsg);
      }
      
      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch (parseErr) { throw parseErr; }
      
      if (data.avatarUrl) {
        if (target.type === 'group' && target.id) {
          setGroups((prev: Group[]) => prev.map(g => g.id === target.id ? { ...g, avatar_url: data.avatarUrl } : g));
          if (activeGroup?.id === target.id) {
            setActiveGroup((prev: any) => prev ? { ...prev, avatar_url: data.avatarUrl } : null);
          }
        } else {
          const updatedUser = { ...user!, avatar_url: data.avatarUrl };
          setUser(updatedUser);
          safeLocalStorage.setItem('user', JSON.stringify(updatedUser));
        }
        showAlert(t?.common?.success || 'Success');
      }
      setAvatarToCrop(null);
    } catch (err: any) {
      console.warn('Failed to upload avatar', err);
      showAlert(`Ошибка при загрузке аватара: ${err.message}`);
    }
  }, [activeGroup, setGroups, setActiveGroup, setUser, showAlert, t, token, user]);

  const handleUpdateProfile = useCallback(async (data: { firstName: string; lastName: string; email: string; phone: string }) => {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const text = await res.text();
      let error: any = {};
      try { error = text ? JSON.parse(text) : {}; } catch (e) {}
      throw new Error(error.error || 'Failed to update profile');
    }
    const updatedUser = { ...user!, first_name: data.firstName, last_name: data.lastName, email: data.email, phone: data.phone };
    setUser(updatedUser);
    safeLocalStorage.setItem('user', JSON.stringify(updatedUser));
  }, [token, user, setUser]);

  const handleChangePassword = useCallback(async (data: { oldPassword: string; newPassword: string }) => {
    let encryptedPrivateKeyData = null;
    const privateKeyJwk = safeLocalStorage.getItem('e2e_private_key');
    
    if (privateKeyJwk) {
      try {
        const privateKey = await importKey(privateKeyJwk, 'private');
        encryptedPrivateKeyData = await encryptPrivateKeyWithPassword(privateKey, data.newPassword);
      } catch (e) {
        throw new Error('Failed to secure private key with new password');
      }
    }

    const payload = {
      ...data,
      encryptedPrivateKey: encryptedPrivateKeyData ? JSON.stringify(encryptedPrivateKeyData) : undefined
    };

    const res = await fetch('/api/users/password', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      let error: any = {};
      try { error = text ? JSON.parse(text) : {}; } catch (e) {}
      throw new Error(error.error || 'Failed to change password');
    }
  }, [token]);

  return {
    avatarToCrop,
    setAvatarToCrop,
    avatarInputRef,
    handleAvatarClick,
    handleAvatarChange,
    handleCropComplete,
    handleUpdateProfile,
    handleChangePassword
  };
}
