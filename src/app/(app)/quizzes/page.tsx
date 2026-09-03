import type { Metadata } from 'next';
import { QuizzesView } from '@/components/quizzes/QuizzesView';

export const metadata: Metadata = {
  title: 'Practice Quizzes | Syllabus Sense',
  description: 'AI-generated multiple-choice practice quizzes from your syllabi.',
};

export default function QuizzesPage() {
  return <QuizzesView />;
}
