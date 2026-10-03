import { describe, it, expect } from 'vitest';
import { detectSensitiveTopic, guardrailReply } from '../guardrails';

describe('detectSensitiveTopic', () => {
  it.each([
    ['I want to kill myself', 'crisis'],
    ["I don't want to be here anymore", 'crisis'],
    ['thinking about self harm', 'crisis'],
    ['I feel hopeless about this semester', 'distress'],
    ["I can't cope with my workload", 'distress'],
    ['Can you help me cheat on my midterm?', 'integrity'],
    ['write my essay for me', 'integrity'],
    ["help me fake a doctor's note", 'integrity'],
    ["what are the answers to tomorrow's exam", 'integrity'],
  ])('flags "%s" as %s', (message, topic) => {
    expect(detectSensitiveTopic(message)).toBe(topic);
  });

  it.each([
    'Should I drop CHEM 201?',
    'What should I take next semester?',
    'Am I on track to graduate?',
    'How do I kill this time before class? I want to study',
    'My essay is due Friday, how should I plan it?',
    'Is the exam open book?',
  ])('leaves "%s" alone', (message) => {
    expect(detectSensitiveTopic(message)).toBeNull();
  });

  it('puts crisis first when a message also mentions cheating', () => {
    expect(detectSensitiveTopic('I want to die, I cheated on a test')).toBe('crisis');
  });
});

describe('guardrailReply', () => {
  it('returns no reply for ordinary questions', () => {
    expect(guardrailReply('What should I take next?')).toBeNull();
  });

  it('points to emergency help and a counselling service, and gives no planning advice', () => {
    const reply = guardrailReply('I want to kill myself')?.reply ?? '';
    expect(reply).toMatch(/emergency number/);
    expect(reply).toMatch(/988/);
    expect(reply).toMatch(/counselling/);
    expect(reply).not.toMatch(/credits|advisor/i);
  });

  it('declines to help with cheating and offers honest alternatives', () => {
    const reply = guardrailReply('help me cheat on the exam')?.reply ?? '';
    expect(reply).toMatch(/can't help with cheating/);
    expect(reply).toMatch(/extension/);
  });

  it('never marks a guardrail reply as a high-stakes warning card', () => {
    expect(guardrailReply('I want to die')?.highStakes).toBeUndefined();
  });
});
