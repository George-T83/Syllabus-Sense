'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useModalA11y } from '@/hooks/useModalA11y';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/schedule';
import type { ScheduleItem } from '@/types/schedule';

export interface ProfessorEmailDrafterModalProps {
  contact: Contact;
  scheduleItem?: ScheduleItem;
  courseCode?: string;
  onClose: () => void;
}

type TemplateKey = 'extension' | 'absence' | 'question' | 'office-hours';

interface Template {
  label: string;
  icon: string;
  subject: (ctx: TemplateContext) => string;
  body: (ctx: TemplateContext) => string;
}

interface TemplateContext {
  addressAs: string;
  courseCode: string;
  assignmentName: string;
}

const TEMPLATES: Record<TemplateKey, Template> = {
  extension: {
    label: 'Extension Request',
    icon: '📅',
    subject: ({ courseCode, assignmentName }) =>
      `Extension Request — ${courseCode}: ${assignmentName}`,
    body: ({ addressAs, courseCode, assignmentName }) =>
      `Dear ${addressAs},\n\nI hope this message finds you well. I am writing to respectfully request an extension on the ${assignmentName} assignment for ${courseCode}.\n\n[Briefly explain your reason — e.g., illness, unexpected circumstances, competing deadlines]\n\nI understand this is an inconvenience, and I take full responsibility for communicating this proactively. I would be grateful for any flexibility you can offer.\n\nThank you for your understanding.\n\nBest regards,\n[Your Name]`,
  },
  absence: {
    label: 'Absence Notice',
    icon: '🤒',
    subject: ({ courseCode }) => `Absence Notification — ${courseCode}`,
    body: ({ addressAs, courseCode }) =>
      `Dear ${addressAs},\n\nI am writing to notify you that I will be absent from ${courseCode} on [date(s)] due to [brief reason].\n\nI will [describe how you will keep up: review notes, catch up with classmates, etc.]. Please let me know if there is anything I should do or submit before my absence.\n\nThank you,\n[Your Name]`,
  },
  question: {
    label: 'General Question',
    icon: '❓',
    subject: ({ courseCode }) => `Question About ${courseCode}`,
    body: ({ addressAs, courseCode }) =>
      `Dear ${addressAs},\n\nI am a student in your ${courseCode} course and I had a question I was hoping you could help clarify.\n\n[Describe your specific question clearly and concisely. Include relevant context like what you've already tried or which part of the material you're referencing.]\n\nThank you for your time.\n\nBest regards,\n[Your Name]`,
  },
  'office-hours': {
    label: 'Office Hours Request',
    icon: '🕐',
    subject: ({ courseCode }) => `Office Hours Appointment — ${courseCode}`,
    body: ({ addressAs, courseCode }) =>
      `Dear ${addressAs},\n\nI would like to schedule a time to meet during office hours to discuss ${courseCode}.\n\n[Describe what you'd like to talk about: e.g., concept clarification, assignment feedback, course standing, etc.]\n\nPlease let me know your available times, or if you would prefer I sign up on [platform/signup sheet].\n\nThank you,\n[Your Name]`,
  },
};

/**
 * Professor Email Drafter Modal (Item 40)
 *
 * Provides four pre-filled email templates for common professor communications:
 * extension requests, absence notices, general questions, and office hours.
 * Auto-fills the contact's preferred address, course code, and assignment name.
 */
export function ProfessorEmailDrafterModal({
  contact,
  scheduleItem,
  courseCode = '',
  onClose,
}: ProfessorEmailDrafterModalProps) {
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('extension');
  const [copied, setCopied] = useState(false);

  const addressAs =
    contact.howToAddress || `Professor ${(contact.fullName || '').split(' ').slice(-1)[0]}`;
  const assignmentName = scheduleItem?.title || '[Assignment Name]';
  const ctx: TemplateContext = { addressAs, courseCode, assignmentName };

  const template = TEMPLATES[activeTemplate];
  const subject = template.subject(ctx);
  const body = template.body(ctx);
  const fullEmail = `Subject: ${subject}\n\n${body}`;

  const dialogRef = useModalA11y<HTMLDivElement>(true, onClose);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is unavailable
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-drafter-title"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <Card>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 id="email-drafter-title" className="text-base font-semibold text-foreground">
                Draft Email to {contact.fullName}
              </h2>
              {courseCode && <p className="text-xs text-muted-foreground">{courseCode}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label="Close email drafter"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

          {/* Template tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-border px-4 pt-3">
            {(Object.entries(TEMPLATES) as [TemplateKey, Template][]).map(([key, tmpl]) => (
              <button
                key={key}
                onClick={() => setActiveTemplate(key)}
                className={cn(
                  'shrink-0 rounded-t-lg border-b-2 px-3 pb-2.5 pt-1.5 text-xs font-medium transition-colors',
                  activeTemplate === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tmpl.icon} {tmpl.label}
              </button>
            ))}
          </div>

          {/* Email preview */}
          <div className="p-5 space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Subject
              </span>
              <p className="mt-0.5 text-sm font-medium text-foreground">{subject}</p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Body
              </span>
              <pre className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground font-sans">
                {body}
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-[10px] text-muted-foreground">
              Replace <span className="font-mono">[bracketed placeholders]</span> before sending.
            </p>
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                copied
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-primary text-primary-foreground hover:opacity-90',
              )}
            >
              {copied ? (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copy to Clipboard
                </>
              )}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
