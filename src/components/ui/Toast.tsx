'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => string;
  showSuccess: (title: string, message?: string) => string;
  showError: (title: string, message?: string) => string;
  showInfo: (title: string, message?: string) => string;
  showWarning: (title: string, message?: string) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toastInput: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID();
      const newToast: Toast = { ...toastInput, id };

      setToasts((prev) => [...prev, newToast]);

      const duration = toastInput.duration ?? DEFAULT_DURATION;
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast],
  );

  const showSuccess = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast],
  );

  const showError = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message }),
    [showToast],
  );

  const showInfo = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast],
  );

  const showWarning = useCallback(
    (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    [showToast],
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showSuccess,
        showError,
        showInfo,
        showWarning,
        removeToast,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 flex max-w-sm flex-col gap-2.5 sm:bottom-6 sm:right-6"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles: Record<ToastType, { container: string; icon: ReactNode }> = {
    success: {
      container: 'border-load-low/40 bg-card text-foreground shadow-lg',
      icon: (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-load-low/15 text-load-low">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ),
    },
    error: {
      container: 'border-destructive/40 bg-card text-foreground shadow-lg',
      icon: (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
      ),
    },
    info: {
      container: 'border-primary/40 bg-card text-foreground shadow-lg',
      icon: (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
      ),
    },
    warning: {
      container: 'border-load-medium/40 bg-card text-foreground shadow-lg',
      icon: (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-load-medium/15 text-load-medium">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </span>
      ),
    },
  };

  const currentStyle = styles[toast.type];

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2',
        currentStyle.container,
      )}
    >
      {currentStyle.icon}
      <div className="flex-1 min-w-0">
        <h4 className="text-label text-foreground">{toast.title}</h4>
        {toast.message && (
          <p className="mt-0.5 text-caption text-muted-foreground">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close notification"
        className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
