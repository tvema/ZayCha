import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

export const DocumentViewer = ({ src, alt, onClose, onGenerateThumbnail }: { src: string, alt: string, onClose: () => void, onGenerateThumbnail?: (thumb: string) => void }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfProxy, setPdfProxy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<'pdf' | 'docx' | 'xlsx' | 'odt' | null>(null);
  const [contentHtml, setContentHtml] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    const loadDocument = async () => {
      try {
        setLoading(true);
        let activeDocType: 'pdf' | 'docx' | 'xlsx' | 'odt' = 'pdf';
        const lowerAlt = alt.toLowerCase();
        if (lowerAlt.endsWith('.docx') || src.includes('wordprocessingml.document')) activeDocType = 'docx';
        else if (lowerAlt.endsWith('.xlsx') || lowerAlt.endsWith('.xls') || lowerAlt.endsWith('.ods') || src.includes('spreadsheetml')) activeDocType = 'xlsx';
        else if (lowerAlt.endsWith('.odt') || src.includes('opendocument.text')) activeDocType = 'odt';
        
        setDocType(activeDocType);

        let typedarray: Uint8Array | null = null;
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

        if (activeDocType === 'pdf') {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
          }
          
          const documentProxy = typedarray 
               ? pdfjsLib.getDocument({ data: typedarray }) 
               : pdfjsLib.getDocument({ url: src });
               
          const pdf = await documentProxy.promise;
          if (!active) return;
          
          setPdfProxy(pdf);
          setNumPages(pdf.numPages);
          setPageNumber(1);
        } else if (activeDocType === 'docx') {
          if (typedarray) {
            // @ts-ignore
            const mammoth = (await import('mammoth/mammoth.browser')).default || (await import('mammoth/mammoth.browser'));
            const result = await mammoth.convertToHtml({ arrayBuffer: typedarray.buffer });
            if (active) setContentHtml(result.value);
          }
        } else if (activeDocType === 'xlsx') {
          if (typedarray) {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(typedarray, { type: 'array' });
            const sheetName = wb.SheetNames[0];
            const html = XLSX.utils.sheet_to_html(wb.Sheets[sheetName], { header: '' });
            if (active) setContentHtml(html);
          }
        } else if (activeDocType === 'odt') {
          if (typedarray) {
            const { odtToHtml } = await import('odf-kit/odt-reader');
            const html = odtToHtml(typedarray);
            if (active) setContentHtml(html);
          }
        }
        
        if (active) setLoading(false);
      } catch (err) {
        console.error("Failed to load document", err);
        if (active) setLoading(false);
      }
    };
    
    loadDocument();
    return () => { active = false; };
  }, [src, alt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (docType === 'pdf') {
        if (e.key === 'ArrowRight' && pageNumber < numPages) setPageNumber(p => p + 1);
        if (e.key === 'ArrowLeft' && pageNumber > 1) setPageNumber(p => p - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, pageNumber, numPages, docType]);

  const onGenerateThumbnailRef = useRef(onGenerateThumbnail);
  useEffect(() => {
    onGenerateThumbnailRef.current = onGenerateThumbnail;
  }, [onGenerateThumbnail]);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      if (docType !== 'pdf' || !pdfProxy || !canvasRef.current) return;
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
    if (!loading && docType === 'pdf') {
      setTimeout(() => { if (active) renderPage(); }, 0);
    }
    return () => { active = false; };
  }, [pdfProxy, pageNumber, scale, loading, docType]);

  const downloadFile = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col touch-none" onClick={(e) => e.stopPropagation()}>
      <div className="absolute top-0 inset-x-0 p-4 flex pl-4 pr-16 md:pr-4 justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="text-white/90 text-sm font-medium truncate max-w-[50%] px-2 pointer-events-auto">
          {alt}
        </div>
        <div className="flex items-center gap-2 pointer-events-auto shadow-lg bg-black/40 rounded-full px-2 py-1" onClick={(e) => e.stopPropagation()}>
          {docType === 'pdf' && numPages > 0 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(0.5, s - 0.2)); }} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all">
                <ZoomOut size={20} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(3, s + 0.2)); }} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all">
                <ZoomIn size={20} />
              </button>
            </>
          )}
          <button onClick={(e) => { e.stopPropagation(); downloadFile(); }} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all" title="Download">
            <Download size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2.5 text-white/70 hover:text-white hover:bg-white/20 rounded-full transition-all">
             <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full pt-20 pb-20 px-4 overflow-auto flex justify-center items-start pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="flex items-center justify-center p-12 mt-20" onClick={(e) => e.stopPropagation()}>
             <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : docType === 'pdf' ? (
          <canvas 
            ref={canvasRef} 
            className="bg-white shadow-xl max-w-full h-auto transition-transform origin-top"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (docType === 'docx' || docType === 'xlsx' || docType === 'odt') ? (
          <div 
            className={`bg-white shadow-xl text-black prose prose-sm md:prose-base prose-indigo overflow-auto ${
              docType === 'xlsx' ? 'rounded-lg max-w-full p-4 w-auto [&_table]:border-collapse [&_table]:border-neutral-300 [&_td]:border [&_td]:border-neutral-300 [&_th]:border [&_th]:border-neutral-300 [&_td]:p-2 [&_th]:p-2 [&_th]:bg-neutral-100' : 'w-full max-w-[21cm] min-h-[29.7cm] p-8 lg:p-12 md:p-10 sm:p-8 shrink-0'
            }`}
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        ) : (
           <div className="text-white mt-10">Unsupported format</div>
        )}
      </div>

      {docType === 'pdf' && numPages > 1 && !loading && (
        <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-10" onClick={(e) => e.stopPropagation()}>
          <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-4 pointer-events-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => { e.stopPropagation(); setPageNumber(p => Math.max(1, p - 1)); }}
              disabled={pageNumber <= 1}
              className="text-white disabled:opacity-30 hover:opacity-80 transition-opacity p-1"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-white text-sm font-medium w-16 text-center shadow-none border-none bg-transparent" onClick={(e) => e.stopPropagation()}>
               {pageNumber} / {numPages}
            </span>
            <button 
              onClick={(e) => { e.stopPropagation(); setPageNumber(p => Math.min(numPages, p + 1)); }}
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
