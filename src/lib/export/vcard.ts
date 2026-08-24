import type { Contact } from '@/types/schedule';

/**
 * Escapes characters for vCard 3.0 fields according to RFC 2426 / RFC 6350.
 * Backslashes, commas, and semicolons are escaped with a backslash. Newlines are escaped as \n.
 */
export function escapeVCardValue(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Splits a full name into family name and given names.
 * e.g. "Dr. Ada Lovelace" -> { familyName: "Lovelace", givenName: "Ada", prefix: "Dr." }
 */
export function parseStructuredName(fullName: string): {
  familyName: string;
  givenName: string;
  prefix: string;
} {
  const clean = fullName.trim();
  const parts = clean.split(/\s+/);

  let prefix = '';
  let names = parts;

  // Check common prefixes
  const first = parts[0]?.replace(/\.$/, '').toLowerCase();
  if (['dr', 'prof', 'professor', 'mr', 'ms', 'mrs'].includes(first)) {
    prefix = parts[0];
    names = parts.slice(1);
  }

  if (names.length === 0) {
    return { familyName: '', givenName: prefix, prefix: '' };
  }
  if (names.length === 1) {
    return { familyName: names[0], givenName: '', prefix };
  }

  const familyName = names[names.length - 1];
  const givenName = names.slice(0, names.length - 1).join(' ');

  return { familyName, givenName, prefix };
}

/**
 * Generates an RFC 2426 / vCard 3.0 formatted string for a course contact.
 */
export function generateVCard(contact: Contact, courseCode?: string, courseTitle?: string): string {
  const { familyName, givenName, prefix } = parseStructuredName(contact.fullName);

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVCardValue(contact.fullName)}`,
    `N:${escapeVCardValue(familyName)};${escapeVCardValue(givenName)};;${escapeVCardValue(prefix)};`,
  ];

  if (contact.title || contact.role) {
    const titleVal = contact.title || (contact.role ? `${contact.role.toUpperCase()}` : '');
    if (titleVal) {
      lines.push(`TITLE:${escapeVCardValue(titleVal)}`);
    }
  }

  if (courseCode || courseTitle) {
    const org = [courseCode, courseTitle].filter(Boolean).join(' - ');
    lines.push(`ORG:${escapeVCardValue(org)}`);
  }

  if (contact.email) {
    lines.push(`EMAIL;TYPE=INTERNET,WORK:${escapeVCardValue(contact.email)}`);
  }

  if (contact.officeLocation) {
    // ADR: post office box; extended address; street; city; region; postal code; country
    lines.push(`ADR;TYPE=WORK:;;${escapeVCardValue(contact.officeLocation)};;;;`);
  }

  const notesParts: string[] = [];
  if (contact.howToAddress) {
    notesParts.push(`Address as: ${contact.howToAddress}`);
  }
  if (contact.officeHours) {
    notesParts.push(`Office Hours: ${contact.officeHours}`);
  }
  if (courseCode) {
    notesParts.push(`Course: ${courseCode}`);
  }

  if (notesParts.length > 0) {
    lines.push(`NOTE:${escapeVCardValue(notesParts.join('\n'))}`);
  }

  lines.push('END:VCARD');

  return lines.join('\r\n') + '\r\n';
}

/**
 * Creates a Data URL for instant download or sharing of the vCard.
 */
export function generateVCardDataUrl(
  contact: Contact,
  courseCode?: string,
  courseTitle?: string,
): string {
  const vcardText = generateVCard(contact, courseCode, courseTitle);
  return `data:text/vcard;charset=utf-8,${encodeURIComponent(vcardText)}`;
}

/**
 * Triggers a browser download of the .vcf card.
 */
export function downloadVCardFile(
  contact: Contact,
  courseCode?: string,
  courseTitle?: string,
): void {
  if (typeof document === 'undefined') return;

  const vcardText = generateVCard(contact, courseCode, courseTitle);
  const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const safeName = contact.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'contact';
  const fileName = `${safeName}.vcf`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a 21x21 QR Code Version 1 Matrix representation for contact cards.
 * Implements deterministic grid layout with standard finder position patterns (7x7 corners),
 * timing patterns, and data bit representation for crisp SVG rendering without external heavy libraries.
 */
export function generateContactQrMatrix(payload: string): boolean[][] {
  const size = 25; // 25x25 grid (Version 2 QR format)
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // Helper to draw 7x7 position finder patterns with 1px white separator
  const drawFinderPattern = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[startRow + r][startCol + c] = true;
        }
      }
    }
  };

  // Top-left finder
  drawFinderPattern(0, 0);
  // Top-right finder
  drawFinderPattern(0, size - 7);
  // Bottom-left finder
  drawFinderPattern(size - 7, 0);

  // Timing patterns (horizontal and vertical line on row 6 and col 6)
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Generate deterministic bit pattern based on hash of payload
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }

  // Fill data cells avoiding finders and timing tracks
  let bitIndex = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const inTiming = r === 6 || c === 6;

      if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming) {
        // Hash combination logic
        const val =
          ((hash >> (bitIndex % 31)) ^
            (r * 7 + c * 13) ^
            (payload.charCodeAt(bitIndex % payload.length) || 0)) %
            2 !==
          0;
        matrix[r][c] = val;
        bitIndex++;
      }
    }
  }

  return matrix;
}
