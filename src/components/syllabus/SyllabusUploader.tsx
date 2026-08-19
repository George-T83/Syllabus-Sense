'use client';

import { useRef, useState, DragEvent } from 'react';
import { useUploadSyllabus } from '@/lib/storage/useUploadSyllabus';
import { validateSyllabusFile } from '@/lib/validation/syllabusFile';
import { cn } from '@/lib/utils';

export interface SyllabusUploaderProps {
  userId: string;
  courseId: string;
  onUploaded?: () => void;
}

export function SyllabusUploader({ userId, courseId, onUploaded }: SyllabusUploaderProps) {
  const { status, progress, error, upload, pause, resume, cancel, reset } = useUploadSyllabus(
    userId,
    courseId,
  );
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const result = validateSyllabusFile(file);
    if (!result.valid) {
      setValidationError(result.error ?? 'Invalid file.');
      return;
    }
    setValidationError(null);
    upload(file)
      .then(() => onUploaded?.())
      .catch(() => {
        // Error state is already surfaced via the hook's `error` field.
      });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const isUploading = status === 'uploading' || status === 'paused';

  return (
    <div className="space-y-2">
      {!isUploading && status !== 'success' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent',
          )}
        >
          <span className="text-sm font-medium text-foreground">
            Drop a syllabus PDF or Word doc here, or click to browse
          </span>
          <span className="text-xs text-muted-foreground">PDF or .docx, up to 10MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {(validationError || error) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {validationError || error}
        </div>
      )}

      {isUploading && (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{status === 'paused' ? 'Paused' : 'Uploading...'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex gap-3 text-xs font-semibold">
            {status === 'uploading' ? (
              <button onClick={pause} className="text-primary hover:underline">
                Pause
              </button>
            ) : (
              <button onClick={resume} className="text-primary hover:underline">
                Resume
              </button>
            )}
            <button onClick={cancel} className="text-destructive hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center justify-between rounded-xl border border-border p-4 text-sm">
          <span className="text-foreground">Upload complete.</span>
          <button onClick={reset} className="text-xs font-semibold text-primary hover:underline">
            Upload another
          </button>
        </div>
      )}
    </div>
  );
}
