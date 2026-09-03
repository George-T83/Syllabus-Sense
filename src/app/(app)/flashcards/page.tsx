import type { Metadata } from 'next';
import { FlashcardsView } from '@/components/flashcards/FlashcardsView';

export const metadata: Metadata = {
  title: 'Flashcards | Syllabus Sense',
  description: 'AI-generated flashcards with spaced-repetition review.',
};

export default function FlashcardsPage() {
  return <FlashcardsView />;
}
