import type { Metadata } from 'next';
import { ProfileView } from '@/components/profile/ProfileView';

export const metadata: Metadata = {
  title: 'Profile | Syllabus Sense',
  description: 'View and edit your student profile settings.',
};

export default function ProfilePage() {
  return <ProfileView />;
}
