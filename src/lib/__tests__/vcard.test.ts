import { describe, it, expect } from 'vitest';
import {
  escapeVCardValue,
  parseStructuredName,
  generateVCard,
  generateContactQrMatrix,
} from '../export/vcard';
import type { Contact } from '@/types/schedule';

describe('vCard Export & QR Matrix Utility (Item 45)', () => {
  it('escapes reserved vCard characters like semicolons, commas, and newlines', () => {
    expect(escapeVCardValue('Smith, Jr.; Ph.D.\nOffice 201')).toBe(
      'Smith\\, Jr.\\; Ph.D.\\nOffice 201',
    );
  });

  it('correctly parses structured names with prefixes, given name, and family name', () => {
    const res1 = parseStructuredName('Dr. Alan M. Turing');
    expect(res1.prefix).toBe('Dr.');
    expect(res1.givenName).toBe('Alan M.');
    expect(res1.familyName).toBe('Turing');

    const res2 = parseStructuredName('Prof. Ada Lovelace');
    expect(res2.prefix).toBe('Prof.');
    expect(res2.givenName).toBe('Ada');
    expect(res2.familyName).toBe('Lovelace');

    const res3 = parseStructuredName('Grace Hopper');
    expect(res3.prefix).toBe('');
    expect(res3.givenName).toBe('Grace');
    expect(res3.familyName).toBe('Hopper');
  });

  it('generates compliant RFC 2426 vCard 3.0 string', () => {
    const mockContact: Contact = {
      id: 'c-101',
      courseId: 'course-1',
      role: 'professor',
      fullName: 'Dr. Katherine Johnson',
      title: 'Professor of Mathematics',
      howToAddress: 'Dr. Johnson',
      email: 'kjohnson@university.edu',
      officeLocation: 'Math Building 402',
      officeHours: 'Mon/Wed 1:00-3:00 PM',
      approved: true,
    };

    const vcard = generateVCard(mockContact, 'MATH 301', 'Calculus III');

    expect(vcard).toContain('BEGIN:VCARD');
    expect(vcard).toContain('VERSION:3.0');
    expect(vcard).toContain('FN:Dr. Katherine Johnson');
    expect(vcard).toContain('N:Johnson;Katherine;;Dr.;');
    expect(vcard).toContain('TITLE:Professor of Mathematics');
    expect(vcard).toContain('ORG:MATH 301 - Calculus III');
    expect(vcard).toContain('EMAIL;TYPE=INTERNET,WORK:kjohnson@university.edu');
    expect(vcard).toContain('ADR;TYPE=WORK:;;Math Building 402;;;;');
    expect(vcard).toContain(
      'NOTE:Address as: Dr. Johnson\\nOffice Hours: Mon/Wed 1:00-3:00 PM\\nCourse: MATH 301',
    );
    expect(vcard).toContain('END:VCARD');
  });

  it('generates a 25x25 QR code matrix with valid corner finders', () => {
    const matrix = generateContactQrMatrix('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Test\r\nEND:VCARD');

    expect(matrix.length).toBe(25);
    expect(matrix[0].length).toBe(25);

    // Top-left 7x7 corner finder check (outer border is filled)
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
    expect(matrix[6][6]).toBe(true);
    // Center of finder is filled
    expect(matrix[3][3]).toBe(true);
  });
});
