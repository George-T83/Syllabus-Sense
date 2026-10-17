import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuizSession } from '../QuizSession';
import type { Quiz } from '@/types/quiz';

const quiz: Quiz = {
  id: 'quiz-1',
  courseId: 'c1',
  createdAt: '2026-08-01T00:00:00.000Z',
  questions: [
    {
      question: 'What is 2 + 2?',
      choices: ['3', '4', '5', '6'],
      correctIndex: 1,
      explanation: 'Basic addition.',
    },
    {
      question: 'Capital of France?',
      choices: ['Rome', 'Madrid', 'Paris', 'Berlin'],
      correctIndex: 2,
      explanation: 'Paris is the capital.',
    },
  ],
};

function setup(onComplete = vi.fn().mockResolvedValue(undefined)) {
  const onClose = vi.fn();
  const utils = render(<QuizSession quiz={quiz} onClose={onClose} onComplete={onComplete} />);
  return { onClose, onComplete, ...utils };
}

const choice = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('QuizSession', () => {
  it('renders nothing when there is no quiz', () => {
    const { container } = render(
      <QuizSession quiz={null} onClose={vi.fn()} onComplete={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('is a modal dialog named by the question counter', () => {
    setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('quiz-session-title');
    expect(screen.getByRole('heading', { name: 'Question 1 of 2' })).toBeDefined();
    expect(screen.getByText('What is 2 + 2?')).toBeDefined();
  });

  it('hides the explanation and Next until an answer is chosen', () => {
    setup();
    expect(screen.queryByText('Basic addition.')).toBeNull();
    expect(screen.queryByRole('button', { name: /Next question/ })).toBeNull();
  });

  it('reveals the explanation and locks every choice after answering', () => {
    setup();
    fireEvent.click(choice('3'));
    expect(screen.getByText('Basic addition.')).toBeDefined();
    for (const label of ['3', '4', '5', '6']) {
      expect(choice(label).disabled).toBe(true);
    }
  });

  it('does not let a second click change the score after answering', async () => {
    const { onComplete } = setup();
    fireEvent.click(choice('3'));
    // Disabled buttons ignore clicks; the correct one must not count after a miss.
    fireEvent.click(choice('4'));
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(choice('Paris'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(1, 2));
  });

  it('advances to the next question and labels the last step Finish', () => {
    setup();
    fireEvent.click(choice('4'));
    fireEvent.click(screen.getByRole('button', { name: 'Next question →' }));
    expect(screen.getByRole('heading', { name: 'Question 2 of 2' })).toBeDefined();
    expect(screen.getByText('Capital of France?')).toBeDefined();
    expect(screen.queryByText('Basic addition.')).toBeNull();
    fireEvent.click(choice('Paris'));
    expect(screen.getByRole('button', { name: 'Finish' })).toBeDefined();
  });

  it('reports a perfect score and confirms it was saved', async () => {
    const { onComplete } = setup();
    fireEvent.click(choice('4'));
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(choice('Paris'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('heading', { name: 'Quiz complete' })).toBeDefined();
    expect(screen.getByText('2 / 2')).toBeDefined();
    expect(await screen.findByText('Score saved to this course.')).toBeDefined();
    expect(onComplete).toHaveBeenCalledWith(2, 2);
  });

  it('counts only correct answers: one right, one wrong scores 1 / 2', async () => {
    const { onComplete } = setup();
    fireEvent.click(choice('4'));
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(choice('Rome'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('1 / 2')).toBeDefined();
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(1, 2));
  });

  it('shows a saving state while the score is being recorded', async () => {
    let resolveSave!: () => void;
    const onComplete = vi.fn().mockReturnValue(new Promise<void>((r) => (resolveSave = r)));
    setup(onComplete);
    fireEvent.click(choice('3'));
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(choice('Madrid'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(await screen.findByText('Saving your score…')).toBeDefined();
    resolveSave();
    expect(await screen.findByText('Score saved to this course.')).toBeDefined();
  });

  it('tells the student their result was not recorded when saving fails', async () => {
    const onComplete = vi.fn().mockRejectedValue(new Error('offline'));
    setup(onComplete);
    fireEvent.click(choice('4'));
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(choice('Paris'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(
      await screen.findByText(
        "Couldn't save your score. Your result isn't recorded for this course.",
      ),
    ).toBeDefined();
    expect(screen.queryByText('Score saved to this course.')).toBeNull();
    // The score is still shown so the student has the result in front of them.
    expect(screen.getByText('2 / 2')).toBeDefined();
  });

  it('closes from the close button and from Done', async () => {
    const first = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close quiz' }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = setup();
    fireEvent.click(choice('4'));
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    fireEvent.click(choice('Paris'));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await screen.findByText('Score saved to this course.');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(second.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not when the card is', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByText('What is 2 + 2?'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
