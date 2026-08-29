'use client';

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { useModalA11y } from '@/hooks/useModalA11y';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/schedule';
import { generateVCard, downloadVCardFile, generateContactQrMatrix } from '@/lib/export/vcard';

export interface ContactShareModalProps {
  contact: Contact | null;
  courseCode?: string;
  courseTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ContactShareModal({
  contact,
  courseCode,
  courseTitle,
  isOpen,
  onClose,
}: ContactShareModalProps) {
  const [activeTab, setActiveTab] = useState<'qr' | 'vcard'>('qr');
  const [copiedVCard, setCopiedVCard] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const vcardText = useMemo(() => {
    if (!contact) return '';
    return generateVCard(contact, courseCode, courseTitle);
  }, [contact, courseCode, courseTitle]);

  const qrMatrix = useMemo(() => {
    if (!vcardText) return [];
    return generateContactQrMatrix(vcardText);
  }, [vcardText]);

  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen || !contact) return null;

  const handleCopyVCard = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(vcardText);
      setCopiedVCard(true);
      setTimeout(() => setCopiedVCard(false), 2000);
    }
  };

  const handleCopySummary = () => {
    const summary = [
      `${contact.fullName} (${contact.role.toUpperCase()})`,
      contact.title ? `Title: ${contact.title}` : '',
      contact.email ? `Email: ${contact.email}` : '',
      contact.officeLocation ? `Office: ${contact.officeLocation}` : '',
      contact.officeHours ? `Office Hours: ${contact.officeHours}` : '',
      courseCode ? `Course: ${courseCode}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(summary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const handleDownload = () => {
    downloadVCardFile(contact, courseCode, courseTitle);
  };

  const mailtoLink = contact.email
    ? `mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(
        courseCode ? `Question regarding ${courseCode}` : 'Course Inquiry',
      )}`
    : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-lg outline-none">
        <Card className="relative">
          <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 id="contact-share-modal-title" className="text-lg font-bold text-foreground">
                    Share Contact Card
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scan instant QR code or download digital vCard
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Close share modal"
                className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Contact Overview Card */}
            <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-base font-bold text-foreground">{contact.fullName}</h4>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/30">
                  {contact.role}
                </span>
              </div>

              {contact.title && <p className="text-xs text-muted-foreground">{contact.title}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
                {contact.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <svg
                      className="w-3.5 h-3.5 text-primary shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.officeLocation && (
                  <div className="flex items-center gap-1.5 truncate">
                    <svg
                      className="w-3.5 h-3.5 text-primary shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="truncate">{contact.officeLocation}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tab Selector */}
            <div className="flex items-center rounded-xl bg-muted/50 p-1 border border-border">
              <button
                onClick={() => setActiveTab('qr')}
                data-testid="tab-qr-code"
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[38px]',
                  activeTab === 'qr'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                QR Code Matrix
              </button>
              <button
                onClick={() => setActiveTab('vcard')}
                data-testid="tab-vcard-text"
                className={cn(
                  'flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[38px]',
                  activeTab === 'vcard'
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                vCard 3.0 Details
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'qr' ? (
              // Kept as a literal white surface with dark modules regardless of
              // theme - QR scanners rely on strong light/dark module contrast,
              // so this square deliberately does not follow the light/dark
              // toggle (a dark-mode-inverted QR code would fail to scan).
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white text-slate-950 shadow-inner">
                {/* Scalable Vector SVG QR Code */}
                <div data-testid="qr-code-svg-container" className="p-3 bg-white rounded-xl">
                  <svg
                    viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                    className="w-48 h-48 sm:w-56 sm:h-56"
                    aria-label={`QR Code for ${contact.fullName}`}
                  >
                    {qrMatrix.map((row, r) =>
                      row.map((filled, c) =>
                        filled ? (
                          <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#0f172a" />
                        ) : null,
                      ),
                    )}
                  </svg>
                </div>
                <p className="text-[11px] font-semibold text-slate-600 mt-2 text-center">
                  Scan with mobile camera to import contact to iOS or Android
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">RFC 2426 format</span>
                  <button
                    onClick={handleCopyVCard}
                    className="text-primary hover:opacity-80 text-xs font-semibold cursor-pointer"
                  >
                    {copiedVCard ? 'Copied to clipboard!' : 'Copy raw vCard'}
                  </button>
                </div>
                <pre
                  data-testid="vcard-raw-preview"
                  className="p-3.5 rounded-xl bg-muted/50 border border-border text-[11px] font-mono text-foreground/80 overflow-x-auto whitespace-pre-wrap max-h-48"
                >
                  {vcardText}
                </pre>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                onClick={handleDownload}
                data-testid="download-vcard-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-xs font-semibold transition-all shadow-lg shadow-primary/20 active:scale-95 cursor-pointer min-h-[44px]"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span>Save .vcf</span>
              </button>

              {mailtoLink ? (
                <a
                  href={mailtoLink}
                  data-testid="email-contact-btn"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-muted/50 hover:bg-accent text-foreground text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Email</span>
                </a>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-muted/30 text-muted-foreground text-xs font-semibold min-h-[44px] cursor-not-allowed"
                >
                  No Email
                </button>
              )}

              <button
                onClick={handleCopySummary}
                data-testid="copy-summary-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-border bg-muted/50 hover:bg-accent text-foreground text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
              >
                <svg
                  className="w-4 h-4"
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
                <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
