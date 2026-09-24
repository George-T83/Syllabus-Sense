/** Excludes visually ambiguous characters (0/O, 1/I/L) so a code stays
 * legible when read aloud or typed from a text message. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

/** A random, human-shareable invite code - also the Firestore document ID of
 * the `courseGroups/{code}` record it identifies. Knowing the code is the
 * only thing that authorizes reading a group's basic metadata (see
 * firestore.rules); at 32^8 (~1.1 trillion) combinations with no way to list
 * or enumerate existing codes, guessing one is not a practical attack for
 * what this gates - the same trust model as a Google Meet or Classroom
 * invite link. */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Formats a raw code for display, e.g. "AB3D-EFGH" - purely cosmetic
 * chunking to make an 8-character code easier to read back over text or
 * voice; the underlying document ID has no hyphen. */
export function formatInviteCodeForDisplay(code: string): string {
  return code.length === CODE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Reverses formatInviteCodeForDisplay and normalizes user-typed input
 * (strips whitespace/hyphens, uppercases) before it's used as a document ID
 * lookup - a join field shouldn't fail just because someone typed lowercase
 * or included the display hyphen. */
export function normalizeInviteCodeInput(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}
