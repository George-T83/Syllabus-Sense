/** The text fields of the contact form, as typed. */
export interface ContactTextFields {
  fullName: string;
  title: string;
  howToAddress: string;
  email: string;
  officeHours: string;
  officeLocation: string;
}

const MAX_LENGTH: Record<keyof ContactTextFields, number> = {
  fullName: 100,
  title: 100,
  howToAddress: 60,
  email: 200,
  officeHours: 200,
  officeLocation: 150,
};

/** Loose on purpose: something@something.tld. It catches typos, not every odd address. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One message per field that is wrong, keyed by field name. An empty result
 * means the form can be saved. Every field is optional except the name, but
 * none may be arbitrarily long (a 5,000-character name used to overflow the
 * contact card) and an email, when given, must look like one.
 */
export function validateContactFields(
  values: ContactTextFields,
): Partial<Record<keyof ContactTextFields, string>> {
  const errors: Partial<Record<keyof ContactTextFields, string>> = {};
  if (!values.fullName.trim()) errors.fullName = 'Full name is required';
  for (const key of Object.keys(MAX_LENGTH) as (keyof ContactTextFields)[]) {
    if (!errors[key] && values[key].trim().length > MAX_LENGTH[key]) {
      errors[key] = `Keep it under ${MAX_LENGTH[key]} characters`;
    }
  }
  const email = values.email.trim();
  if (!errors.email && email && !EMAIL_SHAPE.test(email)) {
    errors.email = 'Enter a valid email address';
  }
  return errors;
}
