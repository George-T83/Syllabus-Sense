'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useAuth } from '@/context/AuthContext';
import {
  PdfViewer,
  type PdfViewerControls,
  type PdfViewerState,
} from '@/components/syllabus/PdfViewer';
import { toProxyUrl } from '@/lib/syllabus/proxyUrl';
import { cn } from '@/lib/utils';
import type { SyllabusUpload } from '@/types/syllabus';

export interface DocumentViewerModalProps {
  syllabus: SyllabusUpload | null;
  onClose: () => void;
}

function getKind(fileName: string): 'pdf' | 'docx' | 'unsupported' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  return 'unsupported';
}

function ToolbarButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Converts an uploaded .docx to HTML client-side via mammoth's browser
 * build (already a dependency for server-side extraction), fetched through
 * the same-origin proxy since the Storage bucket has no CORS config. */
function useDocxHtml(syllabus: SyllabusUpload | null, active: boolean, authToken: string | null) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHtml(null);
    setError(null);
    if (!syllabus || !active || !authToken) return;

    let cancelled = false;
    (async () => {
      try {
        const mammoth = await import('mammoth');
        const response = await fetch(toProxyUrl(syllabus.storagePath, syllabus.fileName), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!response.ok) throw new Error('fetch failed');
        const bytes = await response.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
        if (!cancelled) setHtml(result.value);
      } catch (err) {
        console.error('[DocumentViewerModal] failed to convert docx', err);
        if (!cancelled) setError("Couldn't preview this file.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [syllabus, active, authToken]);

  return { html, error };
}

export function DocumentViewerModal({ syllabus, onClose }: DocumentViewerModalProps) {
  const open = syllabus !== null;
  const containerRef = useModalA11y<HTMLDivElement>(open, onClose);
  const kind = syllabus ? getKind(syllabus.fileName) : 'unsupported';
  const { user } = useAuth();

  // Portalled to document.body: this modal is nested inside course-detail
  // Cards that use backdrop-blur (same containing-block effect as filter/
  // transform), which breaks position:fixed for descendants and pins the
  // "fullscreen" overlay to that ancestor's box instead of the viewport.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // The file proxy requires a fresh ID token per request - fetched once
  // when the viewer opens and reused for the viewer's own fetches; Open/
  // Download re-fetch their own fresh token at click time instead of
  // reusing this one, since it can go stale during a long-open session.
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    setAuthToken(null);
    if (!open || !user) return;
    let cancelled = false;
    user.getIdToken().then((t) => {
      if (!cancelled) setAuthToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, [open, user, syllabus?.id]);

  const { html, error: docxError } = useDocxHtml(syllabus, kind === 'docx', authToken);

  // Opens/downloads via the file proxy using the token already fetched for
  // the viewer (good for the token's ~1hr lifetime - this modal isn't kept
  // open that long). window.open() has to run synchronously inside the
  // click handler, in the same tick as the user gesture, or browsers treat
  // it as an unrequested popup and silently block it - an `await` before
  // it (e.g. fetching a fresh token first) breaks that.
  const openProxied = useCallback(
    (disposition: 'inline' | 'attachment') => {
      if (!syllabus || !authToken) return;
      const url = toProxyUrl(syllabus.storagePath, syllabus.fileName, {
        token: authToken,
        disposition,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [syllabus, authToken],
  );

  const pdfControlsRef = useRef<PdfViewerControls | null>(null);
  const [pdfState, setPdfState] = useState<PdfViewerState>({
    pageNum: 1,
    numPages: 0,
    scalePct: 100,
    loading: true,
    error: null,
  });
  const [pageInput, setPageInput] = useState('1');

  useEffect(() => setPageInput(String(pdfState.pageNum)), [pdfState.pageNum]);

  const registerControls = useCallback((controls: PdfViewerControls) => {
    pdfControlsRef.current = controls;
  }, []);
  const onPdfStateChange = useCallback((state: PdfViewerState) => setPdfState(state), []);

  const commitPageInput = () => {
    const page = Number(pageInput);
    if (Number.isFinite(page)) pdfControlsRef.current?.goToPage(page);
  };

  // Keyboard nav: arrows page-flip, +/- zoom - only while this doc is a PDF
  // and the modal is open (useModalA11y already owns Escape/focus-trap).
  useEffect(() => {
    if (!open || kind !== 'pdf') return;
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowRight') pdfControlsRef.current?.goToPage(pdfState.pageNum + 1);
      else if (e.key === 'ArrowLeft') pdfControlsRef.current?.goToPage(pdfState.pageNum - 1);
      else if (e.key === '+' || e.key === '=') pdfControlsRef.current?.zoomIn();
      else if (e.key === '-') pdfControlsRef.current?.zoomOut();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, kind, pdfState.pageNum]);

  if (!syllabus || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-3 backdrop-blur-sm sm:p-6">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={syllabus.fileName}
        className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-modal"
      >
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white',
                kind === 'pdf' ? 'bg-red-500' : 'bg-blue-500',
              )}
            >
              {kind === 'pdf' ? 'PDF' : 'DOC'}
            </span>
            <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">
              {syllabus.fileName}
            </h2>
          </div>

          {kind === 'pdf' && pdfState.numPages > 0 && (
            <div className="flex shrink-0 items-center gap-1">
              <ToolbarButton
                onClick={() => pdfControlsRef.current?.goToPage(pdfState.pageNum - 1)}
                disabled={pdfState.pageNum <= 1}
                label="Previous page"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </ToolbarButton>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <input
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={commitPageInput}
                  onKeyDown={(e) => e.key === 'Enter' && commitPageInput()}
                  className="h-7 w-9 rounded-md border border-border bg-input text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Page number"
                />
                <span>/ {pdfState.numPages}</span>
              </div>
              <ToolbarButton
                onClick={() => pdfControlsRef.current?.goToPage(pdfState.pageNum + 1)}
                disabled={pdfState.pageNum >= pdfState.numPages}
                label="Next page"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </ToolbarButton>

              <span className="mx-1 h-5 w-px bg-border" />

              <ToolbarButton onClick={() => pdfControlsRef.current?.zoomOut()} label="Zoom out">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                </svg>
              </ToolbarButton>
              <button
                onClick={() => pdfControlsRef.current?.fitWidth()}
                className="w-11 rounded-md text-center text-xs font-medium text-muted-foreground hover:text-foreground"
                title="Fit to width"
              >
                {pdfState.scalePct}%
              </button>
              <ToolbarButton onClick={() => pdfControlsRef.current?.zoomIn()} label="Zoom in">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </ToolbarButton>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1">
            <ToolbarButton onClick={() => openProxied('attachment')} label="Download">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
                />
              </svg>
            </ToolbarButton>
            <ToolbarButton onClick={() => openProxied('inline')} label="Open in new tab">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </ToolbarButton>
            <ToolbarButton onClick={onClose} label="Close">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </ToolbarButton>
          </div>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-hidden">
          {kind === 'pdf' && (
            <>
              {pdfState.error ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                  <p className="text-sm text-muted-foreground">{pdfState.error}</p>
                  <button
                    onClick={() => openProxied('inline')}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Open in new tab instead
                  </button>
                </div>
              ) : !authToken ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : (
                <>
                  {pdfState.loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-accent/30">
                      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                  <PdfViewer
                    url={toProxyUrl(syllabus.storagePath, syllabus.fileName)}
                    authToken={authToken}
                    registerControls={registerControls}
                    onStateChange={onPdfStateChange}
                  />
                </>
              )}
            </>
          )}

          {kind === 'docx' && (
            <div className="h-full overflow-auto bg-accent/30 p-6">
              {docxError && (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                  <p className="text-sm text-muted-foreground">{docxError}</p>
                  <button
                    onClick={() => openProxied('attachment')}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Download instead
                  </button>
                </div>
              )}
              {!docxError && !html && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              )}
              {!docxError && html && (
                <div
                  className={cn(
                    'docx-page mx-auto max-w-[52rem] rounded-sm bg-white px-12 py-14 text-[15px] leading-relaxed text-slate-900 shadow-lg',
                    '[&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:first:mt-0',
                    '[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold',
                    '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold',
                    '[&_p]:mb-3 [&_table]:w-full [&_table]:border-collapse',
                    '[&_td]:border [&_td]:border-slate-200 [&_td]:p-2',
                    '[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2',
                    '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5',
                    '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5',
                    '[&_a]:text-primary [&_a]:underline',
                  )}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
            </div>
          )}

          {kind === 'unsupported' && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-sm text-muted-foreground">No in-app preview for this file type.</p>
              <button
                onClick={() => openProxied('attachment')}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Download instead
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
