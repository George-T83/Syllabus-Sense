import { describe, it, expect } from 'vitest';
import { validateContactFields, type ContactTextFields } from '../contact';

const ok: ContactTextFields = {
  fullName: 'Dr. Amara Chen',
  title: '',
  howToAddress: '',
  email: 'a.chen@university.edu',
  officeHours: 'Tue/Thu 2-3pm',
  officeLocation: 'Science Hall 214',
};

describe('validateContactFields', () => {
  it('accepts a normal contact and one with only a name', () => {
    expect(validateContactFields(ok)).toEqual({});
    expect(
      validateContactFields({ ...ok, email: '', officeHours: '', officeLocation: '' }),
    ).toEqual({});
  });

  it('requires a name', () => {
    expect(validateContactFields({ ...ok, fullName: '   ' }).fullName).toBe(
      'Full name is required',
    );
  });

  it('rejects an email that is not shaped like one', () => {
    for (const email of ['not-an-email', 'a@b', 'a b@c.co', '@c.co']) {
      expect(validateContactFields({ ...ok, email }).email).toBe('Enter a valid email address');
    }
  });

  it('caps every field, so a 5,000-character name or hours line cannot be saved', () => {
    const errors = validateContactFields({
      ...ok,
      fullName: 'N'.repeat(5000),
      officeHours: 'H'.repeat(3000),
    });
    expect(errors.fullName).toBe('Keep it under 100 characters');
    expect(errors.officeHours).toBe('Keep it under 200 characters');
    expect(validateContactFields({ ...ok, fullName: 'N'.repeat(100) })).toEqual({});
  });
});
