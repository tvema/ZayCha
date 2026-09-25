/**
 * Utility to extract a clean thumbnail from PDF files
 * Works in browser using pdfjs-dist legacy build
 */

export async function extractPdfThumbnail(source: File | Blob | ArrayBuffer | Uint8Array | string): Promise<string | null> {
  if (typeof window === 'undefined' || !source) return null;

  return new Promise(async (resolve) => {
    let finished = false;
    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        resolve(null);
      }
    }, 4500);

    let pdf: any = null;
    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }

      let docParam: any = null;
      if (typeof source === 'string') {
        if (source.startsWith('data:')) {
          const base64 = source.split(',')[1];
          const bin = window.atob(base64);
          const len = bin.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
          docParam = { data: bytes };
        } else if (source.startsWith('blob:')) {
          try {
            const res = await fetch(source);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              docParam = { data: new Uint8Array(buf) };
            }
          } catch {
            docParam = { url: source };
          }
        } else {
          try {
            const res = await fetch(source, { headers: { 'Cache-Control': 'no-cache' } });
            if (res.ok) {
              const buf = await res.arrayBuffer();
              docParam = { data: new Uint8Array(buf) };
            } else {
              docParam = { url: source };
            }
          } catch {
            docParam = { url: source };
          }
        }
      } else if (source instanceof Uint8Array) {
        docParam = { data: source };
      } else if (source instanceof ArrayBuffer) {
        docParam = { data: new Uint8Array(source) };
      } else if (source instanceof Blob) {
        const buf = await source.arrayBuffer();
        docParam = { data: new Uint8Array(buf) };
      }

      if (!docParam || finished) {
        clearTimeout(timeout);
        return resolve(null);
      }

      docParam.disableFontFace = true;
      const documentProxy = pdfjsLib.getDocument(docParam);
      pdf = await documentProxy.promise;

      if (finished || !pdf) {
        clearTimeout(timeout);
        return resolve(null);
      }

      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 1.0 });

      const MAX_DIM = 440;
      const width = vp.width || 0;
      const height = vp.height || 0;
      if (width <= 0 || height <= 0) {
        clearTimeout(timeout);
        return resolve(null);
      }

      const scale = Math.min(1.5, MAX_DIM / Math.max(width, height));
      const thumbVp = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(thumbVp.width));
      canvas.height = Math.max(1, Math.floor(thumbVp.height));
      const ctx = canvas.getContext('2d');

      if (!ctx || finished) {
        clearTimeout(timeout);
        return resolve(null);
      }

      const renderTask = page.render({
        canvasContext: ctx,
        viewport: thumbVp
      });
      await renderTask.promise;

      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        const dataUrl = canvas.toDataURL('image/webp', 0.7);
        resolve(dataUrl);
      }
    } catch (e) {
      console.warn('PDF thumbnail extraction skipped:', e);
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        resolve(null);
      }
    } finally {
      if (pdf) {
        try {
          await pdf.destroy();
        } catch {}
      }
    }
  });
}
