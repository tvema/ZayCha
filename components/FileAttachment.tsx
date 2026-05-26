'use client';
import { safeLocalStorage } from '@/lib/safeStorage';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Download, FileIcon, PlayCircle, Lock, Type, X, Loader2 } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import { getFile } from '@/lib/db';
import { ImageViewer } from './ImageViewer';
import { Portal } from './Portal';
import { AnimatePresence } from 'motion/react';
import { useLanguage } from '@/components/LanguageProvider';
import { decryptFile, decryptAESKeyWithRSA, importKey, base64ToArrayBuffer } from '@/lib/crypto';
import { generatePdfMetadata } from '@/lib/chatUtils';
import { keyRing } from '@/lib/keyRing';
import dynamic from 'next/dynamic';

const DocumentViewer = dynamic(() => import('./DocumentViewer').then(mod => mod.DocumentViewer), { ssr: false });

const getExtensionVisuals = (name: string, mime: string) => {
  const ext = (name ? name.split('.').pop() : '').toLowerCase();
  
  if (mime === 'application/pdf' || ext === 'pdf') {
    return {
      ext: 'PDF',
      bg: 'bg-rose-50/90 dark:bg-rose-950/25 border-rose-200/50 dark:border-rose-900/40',
      badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-400/10',
      text: 'text-rose-500 dark:text-rose-400',
    };
  }
  if (mime?.includes('word') || ['doc', 'docx', 'odt', 'rtf'].includes(ext)) {
    return {
      ext: ext.toUpperCase() || 'DOC',
      bg: 'bg-blue-50/90 dark:bg-blue-950/25 border-blue-200/50 dark:border-blue-900/40',
      badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-400/10',
      text: 'text-blue-500 dark:text-blue-400',
    };
  }
  if (mime?.includes('excel') || mime?.includes('spreadsheet') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return {
      ext: ext.toUpperCase() || 'XLS',
      bg: 'bg-emerald-50/90 dark:bg-emerald-950/25 border-emerald-200/50 dark:border-emerald-900/40',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-400/10',
      text: 'text-emerald-500 dark:text-emerald-400',
    };
  }
  if (mime?.includes('presentation') || ['ppt', 'pptx', 'key'].includes(ext)) {
    return {
      ext: ext.toUpperCase() || 'PPT',
      bg: 'bg-amber-50/90 dark:bg-amber-950/25 border-amber-200/50 dark:border-amber-900/40',
      badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-400/10',
      text: 'text-amber-500 dark:text-amber-400',
    };
  }
  if (mime?.includes('zip') || mime?.includes('tar') || mime?.includes('rar') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      ext: ext.toUpperCase() || 'ZIP',
      bg: 'bg-yellow-50/90 dark:bg-yellow-950/25 border-yellow-250/50 dark:border-yellow-900/40',
      badgeBg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 dark:bg-yellow-400/10',
      text: 'text-yellow-500 dark:text-yellow-400',
    };
  }
  if (mime?.includes('text') || ['txt', 'md', 'json', 'xml', 'yaml', 'yml'].includes(ext)) {
    return {
      ext: ext.toUpperCase() || 'TXT',
      bg: 'bg-neutral-50 dark:bg-neutral-900/80 border-neutral-200 dark:border-neutral-800',
      badgeBg: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 dark:bg-neutral-400/10',
      text: 'text-neutral-500 dark:text-neutral-450',
    };
  }
  return {
    ext: ext.toUpperCase() || 'FILE',
    bg: 'bg-indigo-50/90 dark:bg-indigo-950/25 border-indigo-200/50 dark:border-indigo-900/40',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-400/10',
    text: 'text-indigo-500 dark:text-indigo-400',
  };
};

export const FileAttachment = ({ fileData, senderId, socket, isThumbnail = false, thumbnailClassName, encryptionData, activeGroup, messageId }: { fileData: any, senderId: string, socket: Socket | null, isThumbnail?: boolean, thumbnailClassName?: string, encryptionData?: any, activeGroup?: any, messageId?: string }) => {
  const { t } = useLanguage();
  const [blobUrl, setBlobUrl] = useState<string | null>(fileData.url || null);
  const blobUrlRef = useRef<string | null>(fileData.url || null);
  const rawBlobRef = useRef<Blob | null>(null);
  const [loading, setLoading] = useState(!fileData.url || fileData.isEncrypted);
  const [hasError, setHasError] = useState(false);
  const loadingRef = useRef(loading);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    blobUrlRef.current = blobUrl;
  }, [blobUrl]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDecrypting, setIsDecrypting] = useState(false);
  
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleViewerAction = (e: any) => {
      if (isViewerOpen) {
        if (e.detail?.action === 'reply') {
           window.dispatchEvent(new CustomEvent('message-action-request', { detail: { messageId, action: 'reply' } }));
        } else if (e.detail?.action === 'forward') {
           window.dispatchEvent(new CustomEvent('message-action-request', { detail: { messageId, action: 'forward' } }));
        }
      }
    };
    window.addEventListener('image-viewer-action', handleViewerAction);
    return () => window.removeEventListener('image-viewer-action', handleViewerAction);
  }, [isViewerOpen, messageId]);

  const handleTranscribe = async () => {
    if (!blobUrl || isTranscribing) return;
    setIsTranscribing(true);
    try {
      // Fetch the decrypted blob
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      
      // Convert to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          // Extract base64 without prefix
          const base64data = result.split(',')[1];
          resolve(base64data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      const base64Audio = await base64Promise;

      const token = safeLocalStorage.getItem('token');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          base64Audio,
          mimeType: blob.type || fileData.mime || "audio/webm",
          senderId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Transcription failed on server');
      }

      const data = await response.json();
      setTranscription(data.transcription || 'Не получается транскрибировать');
    } catch (e: any) {
      console.warn("Transcription error:", e);
      setTranscription(e.message === 'Transcription failed on server' ? 'Не получается транскрибировать' : e.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const autoDownload = !fileData.mime?.startsWith('video/') && !fileData.mime?.startsWith('audio/');
  const [shouldDownload, setShouldDownload] = useState(autoDownload);

  useEffect(() => {
    const onTranscribeRequested = (e: any) => {
      if (e.detail?.messageId === messageId) {
        handleTranscribe();
      }
    };
    window.addEventListener('transcribe-requested', onTranscribeRequested);
    return () => window.removeEventListener('transcribe-requested', onTranscribeRequested);
  }, [messageId, blobUrl, isTranscribing]);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;
    
    const isReadyUnencrypted = fileData.url && (!fileData.isEncrypted || fileData.url.startsWith('blob:'));

    const loadFile = async () => {
      // 1. Try to load from IndexedDB cache first
      const uniqueId = fileData.url || fileData.fileId;
      if (uniqueId) {
        try {
          let cachedBlob = await getFile(uniqueId);
          if (cachedBlob && isMounted) {
            if (fileData.mime === 'application/pdf') {
               cachedBlob = new Blob([cachedBlob], { type: 'application/pdf' });
            }
            rawBlobRef.current = cachedBlob;
            currentBlobUrl = URL.createObjectURL(cachedBlob);
            setBlobUrl(currentBlobUrl);
            setLoading(false);
            setHasError(false);
            return; // Found in cache, no need to download!
          }
        } catch (e) {
          console.error("Failed to read from cache", e);
        }
      }

      // 2. If it's a video and user hasn't clicked download yet, wait
      if (!shouldDownload) {
        return;
      }

      if (fileData.url && fileData.isEncrypted && encryptionData) {
        // Handle E2EE file decryption
        try {
          setIsDecrypting(false); // Make sure it's strictly false initially
          // Use fetch to avoid IDM/interceptors popping up download dialogs automatically
          const response = await fetch(fileData.url, {
             headers: {
               'X-Requested-With': 'XMLHttpRequest',
               'Cache-Control': 'no-cache'
             }
          });
          if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
          
          const contentLength = response.headers.get('content-length');
          const total = contentLength ? parseInt(contentLength, 10) : 0;
          let loaded = 0;
          
          if (!response.body) throw new Error("No response body");
          const reader = response.body.getReader();
          const chunks = [];
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loaded += value.length;
              if (total && isMounted) {
                 setProgress(Math.round((loaded / total) * 100));
              }
            }
          }
          
          const encryptedBuffer = new Uint8Array(loaded);
          let offset = 0;
          for (const chunk of chunks) {
            encryptedBuffer.set(chunk, offset);
            offset += chunk.length;
          }
          
          setIsDecrypting(true); // NOW we are actually decrypting
          const encryptedArrayBuffer = encryptedBuffer.buffer.slice(encryptedBuffer.byteOffset, encryptedBuffer.byteOffset + encryptedBuffer.byteLength);
          
          const userStr = safeLocalStorage.getItem('user');
          
          if (userStr) {
            const user = JSON.parse(userStr);
            let aesKey: CryptoKey | null = null;
            let ivBase64: string | undefined;

            if (fileData.fileKey && fileData.fileIv) {
               console.log('[FileAttachment] Found fileKey and fileIv in fileData, using explicit file key', { fileKeyLen: fileData.fileKey.length, fileIvLen: fileData.fileIv.length });
               const rawKey = new Uint8Array(base64ToArrayBuffer(fileData.fileKey));
               aesKey = await window.crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
               ivBase64 = fileData.fileIv;
            } else {
              let encryptedAesKey: string | undefined;
              console.log('[FileAttachment] No fileKey/fileIv in fileData. Falling back to encryptionData.', { hasEncryptionData: !!encryptionData, hasGroup: !!activeGroup });
              
              if (activeGroup && activeGroup.encrypted_keys) {
                let keysObj: Record<string, string>;
                try {
                  keysObj = JSON.parse(activeGroup.encrypted_keys);
                } catch (e) {
                  keysObj = { "1": activeGroup.encrypted_keys };
                }
                encryptedAesKey = keysObj[encryptionData?.key_version?.toString() || "1"];
              } else if (encryptionData?.keys) {
                encryptedAesKey = encryptionData.keys[user.id];
              }
              
              if (encryptedAesKey) {
                aesKey = await keyRing.getAesKey(encryptedAesKey);
                ivBase64 = encryptionData?.fileIv || encryptionData?.iv;
                console.log('[FileAttachment] Found encryptedAesKey, decrypted aesKey?', !!aesKey, 'ivBase64:', !!ivBase64);
              } else {
                console.log('[FileAttachment] No encryptedAesKey found. encryptionData.keys:', encryptionData?.keys, 'user.id:', user.id);
              }
            }
            
            if (aesKey && ivBase64) {
              const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
              
              const decryptedBlob = await decryptFile(encryptedArrayBuffer, aesKey, iv);
              let finalBlob = decryptedBlob;
              if (fileData.mime === 'application/pdf') {
                 finalBlob = new Blob([decryptedBlob], { type: 'application/pdf' });
              }
              if (isMounted) {
                rawBlobRef.current = finalBlob;
                currentBlobUrl = URL.createObjectURL(finalBlob);
                setBlobUrl(currentBlobUrl);
                setLoading(false);
                setHasError(false);
                // SAVE TO CACHE!
                if (uniqueId) {
                  import('@/lib/db').then(({ saveFile }) => {
                    saveFile(uniqueId, decryptedBlob).catch(e => console.error("Failed to cache file", e));
                  });
                }
              }
            } else {
               console.error("No encrypted AES key found for this user or missing IV");
               setHasError(true);
            }
          }
        } catch (e) {
          console.error("Failed to decrypt file", e);
          setHasError(true);
        } finally {
          if (isMounted) setIsDecrypting(false);
        }
        return;
      }

      // Request file via WebRTC (unencrypted p2p)
      if (socket && isMounted && fileData.fileId) {
        setHasError(false);
        socket.emit('webrtc:request_file', {
          targetId: senderId,
          fileId: fileData.fileId
        });
      }
    };
    
    if (!isReadyUnencrypted) {
      loadFile();
    }

    const handleFileDownloaded = (e: any) => {
      if (e.detail.fileId === fileData.fileId && isMounted) {
        loadFile();
      }
    };

    const handleFileProgress = (e: any) => {
      if (e.detail.fileId === fileData.fileId && isMounted) {
        setProgress(e.detail.progress);
      }
    };

    const handleWebrtcFailed = (e: any) => {
      if (e.detail.peerId === senderId && isMounted && loading) {
        setHasError(true);
      }
    };

    const handleUserOnline = (data: any) => {
      if (data.userId === senderId && isMounted && loading) {
        loadFile();
      }
    };

    const handleSaveFileRequested = async (e: any) => {
      console.log('FileAttachment save-file-requested event:', e.detail, 'isThumbnail:', isThumbnail, 'messageId:', messageId, 'my expected messageId:', messageId);
      if (isThumbnail) return;
      const targetId = fileData.fileId || fileData.url;
      console.log('Comparing targetId:', targetId, 'with event fileId:', e.detail.fileId);
      
      // If messageId is provided in the event, ensure it matches this instance's messageId
      if (e.detail.messageId && messageId && e.detail.messageId !== messageId) {
          console.log('Message ID mismatch. Expected:', messageId, 'Got:', e.detail.messageId);
          return;
      }
      
      console.log('Event matches this attachment. isMounted:', isMounted);
      
      if (e.detail.fileId === targetId && isMounted) {
        const currentBlob = blobUrlRef.current;
        const currentLoading = loadingRef.current;
        console.log('Current blob:', currentBlob, 'Loading:', currentLoading);
        if (currentBlob && !currentLoading) {
          console.log('Proceeding with blob download block...');
          try {
            // Fetch blob from the object URL so we have the actual data for Web Share API if needed
            let blob: Blob | null = rawBlobRef.current;
            console.log('Native Share blob:', blob);
            
            if (navigator.share) {
               try {
                 if (!blob && currentBlob.startsWith('blob:')) {
                   console.log('Fetching blob for sharing');
                   const response = await fetch(currentBlob);
                   blob = await response.blob();
                   rawBlobRef.current = blob;
                 }
                 if (blob) {
                   const fileName = fileData.name || 'file';
                   let mimeType = blob.type || fileData.mime || 'application/octet-stream';
                   
                   // Infer mime from extension if octet-stream or empty so mobile OS recognizes it
                   if (!mimeType || mimeType === 'application/octet-stream') {
                     const ext = fileName.toLowerCase().split('.').pop();
                     if (ext === 'mp4') mimeType = 'video/mp4';
                     else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                     else if (ext === 'png') mimeType = 'image/png';
                     else if (ext === 'gif') mimeType = 'image/gif';
                     else if (ext === 'mp3') mimeType = 'audio/mpeg';
                     else if (ext === 'pdf') mimeType = 'application/pdf';
                   }

                   const file = new File([blob], fileName, { type: mimeType });
                   
                   console.log('Invoking navigator.share with type:', mimeType);
                   await navigator.share({
                     files: [file],
                     title: fileName,
                   });
                   return; // Success using native share
                 } else if (!currentBlob.startsWith('blob:')) {
                   console.log('Invoking navigator.share for URL');
                   await navigator.share({
                     url: currentBlob,
                     title: fileData.name || 'File from ZState',
                   });
                   return;
                 }
               } catch (err: any) {
                 console.log('Web Share API failed, falling back to download link', err);
                 if (err.name === 'AbortError') {
                   // User cancelled native share. Do not fallback to download dialog.
                   return;
                 }
               }
            }

            // Fallback to traditional anchor tag download
            const isBlobUrl = currentBlob.startsWith('blob:');
            const downloadUrl = isBlobUrl 
              ? currentBlob 
              : `/api/download?url=${encodeURIComponent(currentBlob)}&filename=${encodeURIComponent(fileData.name || 'file')}`;
              
            console.log('Generated download loop. isBlobUrl:', isBlobUrl, 'downloadUrl:', downloadUrl);

            if (isBlobUrl) {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = fileData.name || 'file';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                console.log('Opening standard URL via anchor');
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = fileData.name || 'file';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
          } catch (err: any) {
            console.error('Save failed:', err);
            alert('Не удалось сохранить файл: ' + err.message);
          }
        } else if (fileData.url && (!fileData.isEncrypted || fileData.url.startsWith('blob:'))) {
           console.log('Proceeding with the fallback/direct URL download block');
           // Direct download link for unencrypted or already processed blob url
          try {
             // ...

            const isBlobUrl = fileData.url.startsWith('blob:');
            const downloadUrl = isBlobUrl 
              ? fileData.url 
              : `/api/download?url=${encodeURIComponent(fileData.url)}&filename=${encodeURIComponent(fileData.name || 'file')}`;

            if (isBlobUrl) {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = fileData.name || 'file';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } else {
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = fileData.name || 'file';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
          } catch (err: any) {
            alert('Не удалось скачать файл: ' + err.message);
          }
        } else {
          // It might not be loaded in THIS component, but could be in cache!
          const uniqueId = fileData.url || fileData.fileId;
          if (uniqueId) {
            console.log('Attachment not loaded in this instance. Checking cache directly for', uniqueId);
            import('@/lib/db').then(async ({ getFile }) => {
               try {
                 const cachedBlob = await getFile(uniqueId);
                 if (cachedBlob) {
                    const fileName = fileData.name || 'file';
                    let mimeType = cachedBlob.type || fileData.mime || 'application/octet-stream';
                    
                    if (!mimeType || mimeType === 'application/octet-stream') {
                      const ext = fileName.toLowerCase().split('.').pop();
                      if (ext === 'mp4') mimeType = 'video/mp4';
                      else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                      else if (ext === 'png') mimeType = 'image/png';
                      else if (ext === 'gif') mimeType = 'image/gif';
                      else if (ext === 'mp3') mimeType = 'audio/mpeg';
                      else if (ext === 'pdf') mimeType = 'application/pdf';
                    }
                    const file = new File([cachedBlob], fileName, { type: mimeType });
                    
                    if (navigator.share) {
                       try {
                          console.log('Invoking navigator.share from cache check');
                          await navigator.share({ files: [file], title: fileName });
                          return;
                       } catch (err: any) {
                          console.log('Web share from cache failed', err);
                          if (err.name === 'AbortError') return;
                       }
                    }
                    
                    const u = URL.createObjectURL(cachedBlob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = u;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(u), 1000);
                 } else {
                    alert('Нельзя скачать файл, так как он еще не загружен.');
                 }
               } catch(e) {
                 alert('Нельзя скачать файл, так как он еще не загружен.');
               }
            }).catch(() => {
               alert('Нельзя скачать файл, так как он еще не загружен.');
            });
          } else {
            alert('Нельзя скачать файл, так как он еще не загружен.');
          }
        }
      }
    };

    window.addEventListener('save-file-requested', handleSaveFileRequested);
    window.addEventListener('file-downloaded', handleFileDownloaded);
    window.addEventListener('file-progress', handleFileProgress);
    window.addEventListener('file-send-progress', handleFileProgress);
    window.addEventListener('webrtc-failed', handleWebrtcFailed);
    socket?.on('user:online', handleUserOnline);

    return () => {
      isMounted = false;
      window.removeEventListener('save-file-requested', handleSaveFileRequested);
      window.removeEventListener('file-downloaded', handleFileDownloaded);
      window.removeEventListener('file-progress', handleFileProgress);
      window.removeEventListener('file-send-progress', handleFileProgress);
      window.removeEventListener('webrtc-failed', handleWebrtcFailed);
      socket?.off('user:online', handleUserOnline);
      if (currentBlobUrl && (!fileData.url || fileData.isEncrypted)) URL.revokeObjectURL(currentBlobUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileData.fileId, fileData.url, fileData.isEncrypted, senderId, socket, retryCount, shouldDownload, encryptionData, messageId]);

  const getContainerDimensions = () => {
    if (!fileData.width || !fileData.height) return null;
    const maxWidth = 500;
    const maxHeight = 256; 
    let w = fileData.width;
    let h = fileData.height;
    
    if (w > maxWidth) {
       h = Math.round(h * (maxWidth / w));
       w = maxWidth;
    }
    if (h > maxHeight) {
       w = Math.round(w * (maxHeight / h));
       h = maxHeight;
    }
    
    return { 
      width: w, 
      maxWidth: '100%', 
      height: 'auto', 
      aspectRatio: `${fileData.width}/${fileData.height}` 
    };
  };

  const containerStyle = getContainerDimensions();
  const hasDimensions = !!containerStyle;

  if (isThumbnail) {
    const isLargeTile = thumbnailClassName?.includes('!w-full');
    const extVisuals = getExtensionVisuals(fileData.name, fileData.mime);

    const handleThumbnailClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (loading && !shouldDownload) {
        setShouldDownload(true);
      } else if (!loading) {
        const isPdf = fileData.mime === 'application/pdf';
        const isImg = fileData.mime?.startsWith('image/');
        const isVid = fileData.mime?.startsWith('video/');
        if (isPdf || isImg || isVid) {
          setIsViewerOpen(true);
        } else {
          if (blobUrl) {
            const a = document.createElement('a');
            a.download = fileData.name || 'file';
            a.href = blobUrl;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
            setShouldDownload(true);
          }
        }
      }
    };

    if (loading) {
      if ((fileData.mime?.startsWith('image/') || fileData.mime?.startsWith('video/')) && fileData.thumbnail) {
        return (
          <div onClick={handleThumbnailClick} className={`relative shrink-0 rounded-lg overflow-hidden border border-neutral-200 cursor-pointer ${thumbnailClassName || 'w-12 h-12'}`}>
            <Image 
              src={fileData.thumbnail} 
              alt="loading" 
              fill 
              className="object-cover" 
              unoptimized
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              {isDecrypting ? <Lock size={16} className="text-white animate-pulse" /> : <Download size={16} className={hasError ? 'text-red-400' : 'text-white animate-pulse'} />}
            </div>
          </div>
        );
      }
      
      if (isLargeTile) {
        return (
          <div onClick={handleThumbnailClick} className={`relative flex flex-col items-center justify-center cursor-pointer overflow-hidden rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-sm ${extVisuals.bg} ${thumbnailClassName || 'w-full h-full'}`}>
            <div className={`text-4xl font-black tracking-wider opacity-35 select-none ${extVisuals.text}`}>
              {extVisuals.ext}
            </div>
            <div className="absolute top-3 left-3">
              <FileIcon className={`w-5 h-5 ${extVisuals.text}`} />
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/5 dark:bg-black/20 backdrop-blur-xs gap-1.5 z-10">
              {isDecrypting ? (
                <Lock size={20} className="text-neutral-700 dark:text-neutral-300 animate-pulse" />
              ) : (
                <Loader2 size={24} className="text-indigo-500 animate-spin" />
              )}
              {progress > 0 && progress < 100 && (
                <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-white/70 dark:bg-black/50 px-1.5 py-0.5 rounded-full">{progress}%</span>
              )}
            </div>
            <div className="absolute bottom-0 inset-x-0 bg-white/80 dark:bg-neutral-900/85 backdrop-blur-xs border-t border-neutral-150 dark:border-neutral-800 p-2 text-center select-none">
              <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">{fileData.name}</p>
            </div>
          </div>
        );
      }

      return (
        <div onClick={handleThumbnailClick} className={`rounded-lg ${extVisuals.bg} flex items-center justify-center border border-neutral-200 shrink-0 cursor-pointer ${thumbnailClassName || 'w-12 h-12'}`}>
          {isDecrypting ? <Lock size={20} className="text-indigo-400 animate-pulse" /> : <Download size={20} className={hasError ? 'text-red-400' : 'text-neutral-400 animate-pulse'} />}
        </div>
      );
    }

    if (fileData.mime.startsWith('image/')) {
      return (
        <div onClick={handleThumbnailClick} className={`relative shrink-0 cursor-pointer ${thumbnailClassName || 'w-12 h-12'}`}>
          <Image 
            src={blobUrl!} 
            alt="" 
            fill 
            className="object-cover rounded-lg border border-neutral-200" 
            referrerPolicy="no-referrer"
            unoptimized={fileData.isEncrypted || blobUrl?.startsWith('blob:')}
          />
          {isViewerOpen && !loading && blobUrl && (
            <Portal>
              <ImageViewer src={blobUrl} alt={fileData.name} onClose={() => setIsViewerOpen(false)} />
            </Portal>
          )}
        </div>
      );
    }

    if (fileData.mime.startsWith('video/')) {
      return (
        <div onClick={handleThumbnailClick} className={`relative shrink-0 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 flex items-center justify-center cursor-pointer ${thumbnailClassName || 'w-12 h-12'}`}>
          {fileData.thumbnail && (
            <Image 
              src={fileData.thumbnail} 
              alt="" 
              fill 
              className="object-cover opacity-50 absolute inset-0 z-0" 
              unoptimized
            />
          )}
          <PlayCircle size={20} className="text-white drop-shadow-md z-10" />
          {isViewerOpen && !loading && blobUrl && (
            <Portal>
              <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setIsViewerOpen(false); }}>
                <button onClick={(e) => { e.stopPropagation(); setIsViewerOpen(false); }} className="absolute top-4 right-4 text-white/50 hover:text-white p-2 z-10 transition-colors">
                  <X size={28} />
                </button>
                <video 
                  src={blobUrl} 
                  controls 
                  autoPlay 
                  className="max-w-full max-h-full rounded-lg shadow-2xl" 
                  onClick={(e) => e.stopPropagation()} 
                />
              </div>
            </Portal>
          )}
        </div>
      );
    }

    if (fileData.mime.startsWith('audio/')) {
      return (
        <div className={`rounded-lg bg-indigo-50 dark:bg-indigo-950/25 flex flex-col items-center justify-center border border-indigo-100 dark:border-indigo-900/30 shrink-0 cursor-pointer ${thumbnailClassName || 'w-12 h-12'}`}>
          <PlayCircle size={isLargeTile ? 32 : 20} className="text-indigo-500 dark:text-indigo-400 animate-pulse" />
          {isLargeTile && (
            <div className="absolute bottom-0 inset-x-0 bg-white/80 dark:bg-neutral-900/85 backdrop-blur-xs border-t border-neutral-150 dark:border-neutral-800 p-2 text-center select-none">
              <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">{fileData.name}</p>
            </div>
          )}
        </div>
      );
    }

    /* 
     * ==========================================
     * ВАЖНО / IMPORTANT - DO NOT REMOVE!
     * Мы используем эту красивую подложку с БОЛЬШИМИ буквами расширения файла (PDF, ZIP, DOCX),
     * если у файла нет сгенерированного превью-изображения (thumbnail).
     * Если превью есть (для PDF оно генерируется при первом просмотре), мы натягиваем его как фоновую картинку.
     * ==========================================
     */
    if (fileData.thumbnail) {
      return (
        <div onClick={handleThumbnailClick} className={`relative rounded-xl overflow-hidden cursor-pointer group bg-neutral-100 dark:bg-neutral-800 shadow-sm border border-neutral-200/50 dark:border-neutral-700/50 ${thumbnailClassName || 'w-12 h-12'}`}>
          <Image 
            src={fileData.thumbnail} 
            alt={fileData.name || ""} 
            fill 
            className="object-cover group-hover:scale-105 transition-transform duration-300" 
            unoptimized
          />
          <div className="absolute top-2 left-2 z-10">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs ${extVisuals.badgeBg}`}>
              {extVisuals.ext}
            </span>
          </div>
          {isLargeTile && (
            <div className="absolute bottom-0 inset-x-0 bg-white/85 dark:bg-neutral-900/85 backdrop-blur-xs border-t border-neutral-150 dark:border-neutral-800 p-2 text-center select-none">
              <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">{fileData.name}</p>
              <p className="text-[9px] text-neutral-400 dark:text-neutral-500">{(fileData.size / 1024).toFixed(1)} KB</p>
            </div>
          )}
          {isViewerOpen && blobUrl && fileData.mime === 'application/pdf' && (
            <Portal>
              <AnimatePresence>
                <DocumentViewer 
                  src={blobUrl} 
                  alt={fileData.name} 
                  onClose={() => setIsViewerOpen(false)} 
                  onGenerateThumbnail={(thumb) => {
                    if (!fileData.thumbnail && messageId && socket) {
                      socket.emit('message:update-thumbnail', {
                         messageId,
                         thumbnail: thumb,
                         chatId: activeGroup ? null : senderId,
                         groupId: activeGroup?.id || null
                      });
                    }
                  }}
                />
              </AnimatePresence>
            </Portal>
          )}
        </div>
      );
    }

    if (isLargeTile) {
      return (
        <div onClick={handleThumbnailClick} className={`relative flex flex-col items-center justify-center cursor-pointer overflow-hidden rounded-xl border border-neutral-200/50 dark:border-neutral-700/50 shadow-sm ${extVisuals.bg} ${thumbnailClassName || 'w-full h-full'}`}>
          <div className="absolute top-3 left-3 opacity-80">
            <FileIcon className={`w-5 h-5 ${extVisuals.text}`} />
          </div>
          <div className="flex flex-col items-center justify-center -translate-y-2 select-none group-hover:scale-105 transition-transform duration-300">
            <span className={`text-4xl font-black tracking-wider ${extVisuals.text}`}>
              {extVisuals.ext}
            </span>
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 opacity-80 uppercase mt-0.5">
              {(fileData.size / 1024).toFixed(1)} KB
            </span>
          </div>
          <div className="absolute bottom-0 inset-x-0 bg-white/80 dark:bg-neutral-900/85 backdrop-blur-xs border-t border-neutral-150 dark:border-neutral-800 p-2 text-center select-none">
            <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate px-1">{fileData.name}</p>
          </div>
          
          {isViewerOpen && blobUrl && fileData.mime === 'application/pdf' && (
            <Portal>
              <AnimatePresence>
                <DocumentViewer 
                  src={blobUrl} 
                  alt={fileData.name} 
                  onClose={() => setIsViewerOpen(false)} 
                  onGenerateThumbnail={(thumb) => {
                    if (!fileData.thumbnail && messageId && socket) {
                      socket.emit('message:update-thumbnail', {
                         messageId,
                         thumbnail: thumb,
                         chatId: activeGroup ? null : senderId,
                         groupId: activeGroup?.id || null
                      });
                    }
                  }}
                />
              </AnimatePresence>
            </Portal>
          )}
        </div>
      );
    }

    return (
      <div onClick={handleThumbnailClick} className={`rounded-xl flex flex-col items-center justify-center cursor-pointer border shadow-sm ${extVisuals.bg} ${thumbnailClassName || 'w-12 h-12'}`}>
        <span className={`text-[10px] font-black tracking-wider ${extVisuals.text}`}>
          {extVisuals.ext}
        </span>
        
        {isViewerOpen && blobUrl && fileData.mime === 'application/pdf' && (
          <Portal>
            <AnimatePresence>
              <DocumentViewer 
                src={blobUrl} 
                alt={fileData.name} 
                onClose={() => setIsViewerOpen(false)} 
                onGenerateThumbnail={(thumb) => {
                  if (!fileData.thumbnail && messageId && socket) {
                    socket.emit('message:update-thumbnail', {
                       messageId,
                       thumbnail: thumb,
                       chatId: activeGroup ? null : senderId,
                       groupId: activeGroup?.id || null
                    });
                  }
                }}
              />
            </AnimatePresence>
          </Portal>
        )}
      </div>
    );
  }

  const isImage = fileData.mime?.startsWith('image/');
  const isVideo = fileData.mime?.startsWith('video/');
  const isPdfPreview = fileData.mime === 'application/pdf';

  if (isImage || isVideo || isPdfPreview) {
    let appliedStyle: React.CSSProperties = { 
      WebkitTouchCallout: 'none', 
      WebkitUserSelect: 'none', 
      userSelect: 'none' 
    };
    
    if (hasDimensions && containerStyle) {
      appliedStyle = { ...appliedStyle, ...containerStyle };
    } else if (loading || (!imageLoaded && (isImage || isPdfPreview))) {
      // Conservative default for files without metadata to prevent collapsing
      // 256px perfectly matches max-h-64 used by the loaded image
      appliedStyle = { ...appliedStyle, width: '250px', height: '256px' };
    } else {
      appliedStyle = { ...appliedStyle, minWidth: '200px' };
    }

    return (
      <>
        <div 
          className={`rounded-xl overflow-hidden border border-neutral-200 max-w-full bg-neutral-50 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity relative min-h-[100px] ${(!loading && !hasDimensions && (!isImage || imageLoaded) && !isPdfPreview) ? 'h-auto' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasError) {
              setHasError(false);
              setProgress(0);
              if (fileData.url && fileData.isEncrypted) {
                setRetryCount(c => c + 1);
              } else {
                socket?.emit('webrtc:request_file', { targetId: senderId, fileId: fileData.fileId });
              }
            } else if (loading && !shouldDownload) {
              setShouldDownload(true);
            } else if (!loading && isImage) {
              setIsViewerOpen(true);
            } else if (!loading && isPdfPreview) {
              e.preventDefault();
              setIsViewerOpen(true);
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={appliedStyle}
        >
          {fileData.thumbnail && (
            <Image
              src={fileData.thumbnail}
              alt=""
              fill
              className={`object-cover absolute inset-0 z-0 pointer-events-none select-none transition-opacity duration-300 ${loading ? 'blur-md scale-110 opacity-80' : (!loading && isVideo) ? 'blur-[2px] opacity-70' : ''}`}
              unoptimized
            />
          )}

          {loading && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center z-10 transition-opacity duration-300 ${fileData.thumbnail ? 'bg-black/20 backdrop-blur-[1px]' : 'bg-black/5'}`}>
              {isDecrypting ? (
                <Lock size={24} className="text-white/90 animate-pulse drop-shadow-md mb-2" />
              ) : hasError ? (
                <div className="flex flex-col items-center justify-center gap-1">
                  <Download size={24} className="text-red-400 drop-shadow-md cursor-pointer" />
                  <span className="text-xs font-bold text-red-500 drop-shadow-md bg-white/80 px-2 py-0.5 rounded-full">{t('modals.transferFailed') || 'Retry'}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1">
                  {isVideo && !shouldDownload ? (
                    <Download size={24} className="text-white/80 drop-shadow-md cursor-pointer" />
                  ) : (
                    <Download size={24} className="text-white/80 animate-bounce drop-shadow-md" />
                  )}
                  {progress > 0 && progress < 100 && (
                    <span className="text-xs font-bold text-white drop-shadow-md bg-black/40 px-2 py-0.5 rounded-full">{progress}%</span>
                  )}
                </div>
              )}
              {isVideo && !isDecrypting && !hasError && (
                <PlayCircle size={32} className="text-white/60 drop-shadow-md mt-1 cursor-pointer" />
              )}
            </div>
          )}

          {!loading && blobUrl && isImage && (
            hasDimensions ? (
              <Image 
                src={blobUrl} 
                alt="" 
                width={fileData.width!}
                height={fileData.height!}
                className="w-full h-auto max-w-full max-h-64 object-contain transition-opacity duration-500 ease-in-out z-10 relative pointer-events-none select-none" 
                referrerPolicy="no-referrer"
                unoptimized={fileData.isEncrypted || blobUrl.startsWith('blob:')}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={blobUrl} 
                alt="" 
                className="w-full h-auto max-w-full max-h-64 object-contain transition-opacity duration-500 ease-in-out z-10 relative pointer-events-none select-none" 
                referrerPolicy="no-referrer"
                onLoad={() => setImageLoaded(true)}
              />
            )
          )}

          {!loading && blobUrl && isVideo && (
            <video 
              src={blobUrl} 
              controls 
              className="w-full h-auto max-w-full max-h-64 object-contain z-10 relative" 
              style={hasDimensions && containerStyle ? { width: '100%', height: '100%' } : undefined} 
            />
          )}

          {!loading && blobUrl && isPdfPreview && (
            <div className="absolute top-2 left-2 z-10 flex flex-col justify-start pointer-events-none">
                <div className="bg-black/50 backdrop-blur-md px-2 py-1 rounded-lg shadow-sm flex items-center gap-1.5 max-w-[150px]">
                   <FileIcon size={12} className="text-white shrink-0 drop-shadow-sm" />
                   <span className="text-[10px] font-medium text-white drop-shadow-sm truncate">{fileData.name}</span>
                </div>
            </div>
          )}
        </div>

        {isImage && !loading && blobUrl && (
          <Portal>
            <AnimatePresence>
              {isViewerOpen && (
                <ImageViewer src={blobUrl} alt={fileData.name} onClose={() => setIsViewerOpen(false)} />
              )}
            </AnimatePresence>
          </Portal>
        )}
        {isPdfPreview && !loading && blobUrl && (
          <Portal>
            <AnimatePresence>
              {isViewerOpen && (
                <DocumentViewer 
                  src={blobUrl} 
                  alt={fileData.name} 
                  onClose={() => setIsViewerOpen(false)} 
                  onGenerateThumbnail={(thumb) => {
                    if (!fileData.thumbnail && messageId && socket) {
                      socket.emit('message:update-thumbnail', {
                         messageId,
                         thumbnail: thumb,
                         chatId: activeGroup ? null : senderId,
                         groupId: activeGroup?.id || null
                      });
                    }
                  }}
                />
              )}
            </AnimatePresence>
          </Portal>
        )}
        {isVideo && !loading && blobUrl && (
          <Portal>
            <AnimatePresence>
              {isViewerOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={() => setIsViewerOpen(false)}>
                  <button onClick={() => setIsViewerOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white p-2 z-10 transition-colors">
                    <X size={28} />
                  </button>
                  <video 
                    src={blobUrl} 
                    controls 
                    autoPlay 
                    className="max-w-full max-h-full rounded-lg shadow-2xl" 
                    onClick={(e) => e.stopPropagation()} 
                  />
                </div>
              )}
            </AnimatePresence>
          </Portal>
        )}
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-neutral-200">
        <div className={`w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center ${hasError ? '' : 'animate-pulse'}`}>
          {isDecrypting ? <Lock size={20} className="text-indigo-400" /> : <Download size={20} className={hasError ? 'text-red-400' : 'text-neutral-400'} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-700 truncate">{fileData.name}</p>
          {hasError ? (
            <button 
              onClick={() => {
                setHasError(false);
                setProgress(0);
                if (fileData.url && fileData.isEncrypted) {
                  setRetryCount(c => c + 1);
                } else {
                  socket?.emit('webrtc:request_file', { targetId: senderId, fileId: fileData.fileId });
                }
              }}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              {t('modals.transferFailed')}
            </button>
          ) : (
            <div className="w-full mt-1">
              <div className="flex justify-between text-[10px] text-neutral-500 mb-1">
                <span>{isDecrypting ? t.common?.decrypting || 'Decrypting...' : (progress > 0 ? t.modals?.transferring || 'Downloading...' : (!shouldDownload ? 'Ready to download' : t.modals?.waitingForPeer || 'Connecting...'))}</span>
                <span>{isDecrypting ? '' : `${progress}%`}</span>
              </div>
              {!isDecrypting && (
                <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden relative">
                  <div className="absolute top-0 left-0 bottom-0 bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              )}
              {!shouldDownload && (
                <button 
                  onClick={() => setShouldDownload(true)}
                  className="mt-2 text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg border border-indigo-100 font-medium hover:bg-indigo-100 transition-colors w-full"
                >
                  Download File
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (fileData.mime.startsWith('audio/')) {
    return (
      <div className="flex flex-col gap-2 max-w-full">
        <div className="flex items-center gap-2">
          <div className="rounded-xl overflow-hidden border border-neutral-200 justify-center min-w-[200px] flex-1 bg-neutral-50 flex items-center p-2">
            <audio src={blobUrl!} controls className="w-full h-10" />
          </div>
        </div>
        {isTranscribing && (
          <div className="flex items-center gap-2 p-2 text-sm text-indigo-600">
            <Type size={16} className="animate-pulse" />
            <span>{t('common.transcribing') || 'Transcribing...'}</span>
          </div>
        )}
        {transcription && (
          <div className="bg-white/80 dark:bg-black/20 p-3 rounded-lg text-sm text-neutral-800 dark:text-neutral-200 border border-neutral-100 dark:border-neutral-800">
            {transcription}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div 
        onClick={(e) => {
          if (fileData.mime === 'application/pdf') {
            e.preventDefault();
            setIsViewerOpen(true);
          } else {
            const a = document.createElement('a');
            a.download = fileData.name;
            a.href = blobUrl!;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }}
        className="flex items-center gap-3 p-3 bg-white hover:bg-neutral-50 rounded-xl border border-neutral-200 transition-colors cursor-pointer"
      >
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
          <FileIcon size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-700 truncate max-w-[150px]">{fileData.name}</p>
          <p className="text-xs text-neutral-500">{(fileData.size / 1024).toFixed(1)} KB</p>
        </div>
      </div>

      {fileData.mime === 'application/pdf' && !loading && blobUrl && (
        <Portal>
          <AnimatePresence>
            {isViewerOpen && (
              <DocumentViewer 
                src={blobUrl} 
                alt={fileData.name} 
                onClose={() => setIsViewerOpen(false)} 
                onGenerateThumbnail={(thumb) => {
                  if (!fileData.thumbnail && messageId && socket) {
                    socket.emit('message:update-thumbnail', {
                       messageId,
                       thumbnail: thumb,
                       chatId: activeGroup ? null : senderId,
                       groupId: activeGroup?.id || null
                    });
                  }
                }}
              />
            )}
          </AnimatePresence>
        </Portal>
      )}
    </>
  );
};
