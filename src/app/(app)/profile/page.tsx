import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile | Syllabus Sense',
  description: 'View and edit your student profile settings.',
};

export default function ProfilePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      <p className="text-muted-foreground text-sm">This page will be built out in a later issue.</p>
    </div>
  );
}
