import { describe, it, expect } from 'vitest';
import { courseFormSchema, meetingTimeSchema } from '@/lib/validation/course';

describe('meetingTimeSchema', () => {
  it('accepts a valid meeting time', () => {
    const result = meetingTimeSchema.safeParse({
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:15',
      location: 'Rm 204',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an end time at or before the start time', () => {
    const result = meetingTimeSchema.safeParse({
      dayOfWeek: 1,
      startTime: '10:00',
      endTime: '09:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed time string', () => {
    const result = meetingTimeSchema.safeParse({
      dayOfWeek: 1,
      startTime: '9am',
      endTime: '10:15',
    });
    expect(result.success).toBe(false);
  });
});

describe('courseFormSchema with meetingTimes', () => {
  const base = {
    code: 'CSCI 213',
    title: 'Computer Science I',
    color: 'bg-blue-500',
    icon: 'code',
  };

  it('accepts a course with no meeting times', () => {
    expect(courseFormSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a course with valid recurring meetings and a modality', () => {
    const result = courseFormSchema.safeParse({
      ...base,
      modality: 'in-person',
      meetingTimes: [{ dayOfWeek: 1, startTime: '09:00', endTime: '10:15' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid modality value', () => {
    const result = courseFormSchema.safeParse({ ...base, modality: 'remote' });
    expect(result.success).toBe(false);
  });

  it('surfaces an invalid nested meeting time as a failure', () => {
    const result = courseFormSchema.safeParse({
      ...base,
      meetingTimes: [{ dayOfWeek: 1, startTime: '10:00', endTime: '09:00' }],
    });
    expect(result.success).toBe(false);
  });
});
