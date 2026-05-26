import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

export const DocumentViewer = ({ src, alt, onClose, onGenerateThumbnail }: { src: string, alt: string, onClose: () => void, onGenerateThumbnail?: (thumb: string) => void }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfProxy, setPdfProxy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    const loadPdf = async () => {
      try {
        setLoading(true);
        const pdfjsLib = await import('pdfjs-dist');
        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          try {
            const workerUrl = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
            const response = await fetch(workerUrl);
            const blob = await response.blob();
            pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
          } catch (e) {
            console.warn("Could not fetch pdf worker, falling back", e);
          }
        }
        
        let typedarray;
        if (src.startsWith('data:')) {
          const base64 = src.split(',')[1];
          const binary_string = window.atob(base64);
          const len = binary_string.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binary_string.charCodeAt(i);
          }
          typedarray = bytes;
        } else {
          try {
            const response = await fetch(src, { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Cache-Control': 'no-cache' }});
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              typedarray = new Uint8Array(arrayBuffer);
            }
          } catch (e) {
            console.error("Fetch failed, will fallback", e);
          }
        }
        
        if (!active) return;
        
        const documentProxy = typedarray 
             ? pdfjsLib.getDocument({ data: typedarray }) 
             : pdfjsLib.getDocument({ url: src });
             
        const pdf = await documentProxy.promise;
        
        if (!active) return;
        
        setPdfProxy(pdf);
        setNumPages(pdf.numPages);
        setPageNumber(1);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load PDF", err);
        setLoading(false);
      }
    };
    
    loadPdf();
    return () => { active = false; };
  }, [src]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && pageNumber < numPages) setPageNumber(p => p + 1);
      if (e.key === 'ArrowLeft' && pageNumber > 1) setPageNumber(p => p - 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, pageNumber, numPages]);

  const onGenerateThumbnailRef = useRef(onGenerateThumbnail);
  useEffect(() => {
    onGenerateThumbnailRef.current = onGenerateThumbnail;
  }, [onGenerateThumbnail]);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      if (!pdfProxy || !canvasRef.current) return;
      try {
        if (renderTaskRef.current) {
          try {
             await renderTaskRef.current.cancel();
          } catch(e) {}
          renderTaskRef.current = null;
        }
        const page = await pdfProxy.getPage(pageNumber);
        if (!active) return;
        
        const viewport = page.getViewport({ scale: scale * 1.5 });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
        
        if (active && pageNumber === 1 && onGenerateThumbnailRef.current) {
          const MAX_DIM = 400;
          let thumbW = viewport.width;
          let thumbH = viewport.height;
          if (thumbW > thumbH) {
            if (thumbW > MAX_DIM) {
              thumbH *= MAX_DIM / thumbW;
              thumbW = MAX_DIM;
            }
          } else {
            if (thumbH > MAX_DIM) {
              thumbW *= MAX_DIM / thumbH;
              thumbH = MAX_DIM;
            }
          }
          const thumbCanvas = document.createElement('canvas');
          thumbCanvas.width = thumbW;
          thumbCanvas.height = thumbH;
          const tctx = thumbCanvas.getContext('2d');
          if (tctx) {
            tctx.drawImage(canvas, 0, 0, thumbW, thumbH);
            const thumbnail = thumbCanvas.toDataURL('image/webp', 0.5);
            onGenerateThumbnailRef.current(thumbnail);
          }
        }
      } catch (err: any) {
         if (err.name !== 'RenderingCancelledException') {
            console.error("Page render error", err);
         }
      }
    };
    if (!loading) {
      // Small timeout to allow state to settle
      setTimeout(() => { if (active) renderPage(); }, 0);
    }
    return () => { active = false; };
  }, [pdfProxy, pageNumber, scale, loading]);

  const downloadFile = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col touch-none">
      <div className="absolute top-0 inset-x-0 p-4 flex pl-4 pr-16 md:pr-4 justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="text-white/90 text-sm font-medium truncate max-w-[50%] px-2 pointer-events-auto">
          {alt}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto shadow-lg bg-black/40 rounded-full px-2 py-1">
          {numPages > 0 && (
            <>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all">
                <ZoomOut size={20} />
              </button>
              <button onClick={() => setScale(s => Math.min(3, s + 0.2))} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all">
                <ZoomIn size={20} />
              </button>
            </>
          )}
          <button onClick={downloadFile} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all" title="Download">
            <Download size={20} />
          </button>
          <button onClick={onClose} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all">
             <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full pt-20 pb-20 px-4 overflow-auto flex justify-center items-start pointer-events-auto">
        {loading ? (
          <div className="flex items-center justify-center p-12 mt-20">
             <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <canvas 
            ref={canvasRef} 
            className="bg-white shadow-xl max-w-full h-auto transition-transform origin-top"
          />
        )}
      </div>

      {numPages > 1 && !loading && (
        <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-10">
          <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-4 pointer-events-auto shadow-lg">
            <button 
              onClick={() => setPageNumber(p => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="text-white disabled:opacity-30 hover:opacity-80 transition-opacity p-1"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-white text-sm font-medium w-16 text-center shadow-none border-none bg-transparent">
               {pageNumber} / {numPages}
            </span>
            <button 
              onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="text-white disabled:opacity-30 hover:opacity-80 transition-opacity p-1"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
