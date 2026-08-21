'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

export interface PdfViewerProps {
  url: string;
  /** Firebase ID token attached as an Authorization header on pdfjs's
   * internal fetch - the file proxy requires it, and unlike a plain <a
   * href>, a JS-driven fetch can carry a real header instead of a query
   * param. */
  authToken: string;
  /** Bumped by the parent toolbar's prev/next/zoom controls. */
  registerControls: (controls: PdfViewerControls) => void;
}

export interface PdfViewerControls {
  goToPage: (page: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: () => void;
}

export interface PdfViewerState {
  pageNum: number;
  numPages: number;
  scalePct: number;
  loading: boolean;
  error: string | null;
}

/**
 * Renders one PDF page at a time onto a canvas via pdfjs-dist, instead of
 * handing off to the browser's native (inconsistent, chrome-heavy, can't be
 * themed or controlled) built-in PDF viewer in an <iframe>. Page-by-page
 * rather than continuous scroll - simpler, and still the pattern most
 * desktop PDF readers use for a single-document preview.
 */
export function PdfViewer({
  url,
  authToken,
  registerControls,
  onStateChange,
}: PdfViewerProps & { onStateChange: (state: PdfViewerState) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const naturalWidthRef = useRef<number>(0);

  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the document once per url.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageNum(1);

    const loadingTaskRef: { current: { destroy: () => Promise<void> } | null } = { current: null };

    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`
        // (the usual webpack asset-module pattern) fails Next.js's build -
        // it tries to parse the worker's own ESM syntax into the main
        // bundle instead of just copying it. Served as a plain static file
        // from public/ instead (copied from node_modules/pdfjs-dist/build/
        // pdf.worker.min.mjs - re-copy if pdfjs-dist is ever upgraded).
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        // disableRange/disableStream: the file proxy always returns the
        // whole file rather than honoring byte-range requests, so pdfjs's
        // default progressive range-request fetch would just fail against
        // it. Fine for these small syllabus files - no real streaming
        // benefit lost.
        const loadingTask = pdfjs.getDocument({
          url,
          httpHeaders: { Authorization: `Bearer ${authToken}` },
          disableRange: true,
          disableStream: true,
        });
        loadingTaskRef.current = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) return;
        docRef.current = doc;
        setNumPages(doc.numPages);
      } catch (err) {
        console.error('[PdfViewer] failed to load document', err);
        if (!cancelled) setError("Couldn't load this PDF.");
      }
    })();

    return () => {
      cancelled = true;
      loadingTaskRef.current?.destroy();
      docRef.current = null;
    };
  }, [url, authToken]);

  const renderPage = useCallback(async (page: number, targetScale: number) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;

    renderTaskRef.current?.cancel();
    setLoading(true);
    try {
      const pdfPage = await doc.getPage(page);
      naturalWidthRef.current = pdfPage.getViewport({ scale: 1 }).width;
      const viewport = pdfPage.getViewport({ scale: targetScale * (window.devicePixelRatio || 1) });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const task = pdfPage.render({ canvasContext: ctx, viewport, canvas });
      renderTaskRef.current = task;
      await task.promise;
      setLoading(false);
    } catch (err) {
      // A cancelled render task rejects too - not a real error, just the
      // previous render getting superseded by a newer page/zoom change.
      if (
        err &&
        typeof err === 'object' &&
        'name' in err &&
        err.name === 'RenderingCancelledException'
      ) {
        return;
      }
      console.error('[PdfViewer] failed to render page', err);
      setError("Couldn't render this page.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (numPages > 0) renderPage(pageNum, scale);
  }, [numPages, pageNum, scale, renderPage]);

  useEffect(() => {
    onStateChange({ pageNum, numPages, scalePct: Math.round(scale * 100), loading, error });
  }, [pageNum, numPages, scale, loading, error, onStateChange]);

  useEffect(() => {
    registerControls({
      goToPage: (page) => setPageNum((p) => Math.min(Math.max(page, 1), numPages || p)),
      zoomIn: () => setScale((s) => Math.min(s + SCALE_STEP, MAX_SCALE)),
      zoomOut: () => setScale((s) => Math.max(s - SCALE_STEP, MIN_SCALE)),
      fitWidth: () => {
        const containerWidth = containerRef.current?.clientWidth ?? 0;
        if (containerWidth && naturalWidthRef.current) {
          const fit = (containerWidth - 48) / naturalWidthRef.current;
          setScale(Math.min(Math.max(fit, MIN_SCALE), MAX_SCALE));
        }
      },
    });
    // registerControls is a stable setter from the parent; numPages changes
    // are the only thing that should re-bind goToPage's clamp bound.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages, registerControls]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full items-start justify-center overflow-auto bg-accent/30 p-6"
    >
      <canvas ref={canvasRef} className="rounded-sm bg-white shadow-lg" />
    </div>
  );
}
