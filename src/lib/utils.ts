/**
 * Simple cn/classnames style utility to conditionally join classNames together.
 * Useful for Tailwind CSS projects.
 */
export function cn(
  ...classes: (string | undefined | null | boolean | { [key: string]: boolean })[]
): string {
  const result: string[] = [];

  for (const item of classes) {
    if (!item) continue;

    if (typeof item === 'string') {
      result.push(item);
    } else if (typeof item === 'object') {
      for (const [key, value] of Object.entries(item)) {
        if (value) {
          result.push(key);
        }
      }
    }
  }

  return result.filter(Boolean).join(' ');
}

/** Normalizes a full name for matching the same person across records:
 * case, punctuation, and surrounding whitespace shouldn't cause "Dr. Sarah
 * Chen" and "sarah chen" to read as different people. No fuzzy-matching
 * library - this catches the common real-world cases (titles, periods,
 * extra whitespace) without over-engineering. Shared between syllabus
 * contact-dedup matching and grouping the Contacts page by person. */
export function normalizeContactName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
}

/** Reads a File as base64, stripping the `data:...;base64,` prefix a data
 * URL comes with - every server route that accepts an uploaded file wants
 * the raw base64 payload, not the full data URL. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
