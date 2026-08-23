import type { Metadata } from 'next';
import { ContactsListView } from '@/components/contacts/ContactsListView';

export const metadata: Metadata = {
  title: 'Contacts | Syllabus Sense',
  description: 'Professors and TAs across your courses, in one place.',
};

export default function ContactsPage() {
  return <ContactsListView />;
}
