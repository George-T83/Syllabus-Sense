import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/layout/Logo';

export const metadata: Metadata = {
  title: 'Privacy | Syllabus Sense',
  description: 'What Syllabus Sense stores, what is sent to the AI service, and how to delete it.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
);

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            aria-label="Syllabus Sense home"
            className="flex min-h-9 items-center gap-2"
          >
            <Logo className="h-7 w-7 shrink-0" />
            <span className="font-display text-base font-semibold text-foreground">
              Syllabus Sense
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-9 items-center text-sm font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            How Syllabus Sense handles your data
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            The short version: your schedule is yours, nothing here is sold or used for ads, and the
            one outside service that reads your syllabi is an AI provider. You can export or delete
            everything yourself.
          </p>
          <p className="text-xs text-muted-foreground">Last updated October 17, 2026</p>
        </div>

        <Section title="What is stored in your account">
          <List
            items={[
              'Your sign-in details: your email and name, and a password if you sign up with one. Passwords are handled by Firebase Authentication and are never stored by this app in readable form. If you continue with Google, Google handles the sign-in.',
              'What you add or import: courses, tasks and deadlines, grades and grade scenarios, contacts, flashcards and quizzes, mood check-ins, your degree plan, focus sessions, your Advisor conversations, and your preferences.',
              'The syllabus files you upload (PDF or Word). Storage rules let only your account read them; this app’s server opens them on your behalf when you use an AI feature.',
            ]}
          />
          <P>
            This data is kept in Google Firebase (Authentication, Firestore and Storage). Access
            rules limit each account&apos;s data to that account.
          </P>
        </Section>

        <Section title="What is sent to the AI service">
          <P>
            Some features use Anthropic&apos;s Claude models. Those requests are made from this
            app&apos;s server, and only when you use a feature that needs them:
          </P>
          <List
            items={[
              <>
                <strong className="text-foreground">
                  Syllabus upload, summaries, flashcards, quizzes, cram plans and syllabus chat:
                </strong>{' '}
                the syllabus you chose, the course details you saved for it (code, title,
                instructor, location, materials, objectives and notes), and any question you typed.
                A syllabus can include your instructors&apos; names and contact details, because it
                is the document they wrote.
              </>,
              <>
                <strong className="text-foreground">The Advisor:</strong> your message and recent
                conversation, your major, minor and requirement categories, the courses in your
                degree plan, your course codes, titles and terms, and how many tasks are pending or
                overdue.
              </>,
              <>
                <strong className="text-foreground">Not sent:</strong> your email, name or password,
                your mood check-ins, your contacts list, or the scores you have earned.
              </>,
            ]}
          />
          <P>
            What Anthropic does with API data is set by its own terms and privacy policy, not by
            this app. AI output can be wrong, so check dates and weights against the syllabus before
            relying on them.
          </P>
        </Section>

        <Section title="What is not here">
          <List
            items={[
              'No advertising, and no sale or sharing of your data for marketing.',
              'No analytics or tracking scripts, and no third-party cookies.',
            ]}
          />
        </Section>

        <Section title="On your device">
          <P>
            Your browser keeps your sign-in, display and focus-timer settings, and an offline copy
            of your schedule so the app opens without a connection. Signing out removes the offline
            copy from this device.
          </P>
        </Section>

        <Section title="Your controls">
          <List
            items={[
              <>
                <strong className="text-foreground">Export:</strong> Profile has a download of
                everything in your account, plus your schedule as a calendar file and your contacts
                as a contacts file.
              </>,
              <>
                <strong className="text-foreground">Delete an item:</strong> removing a task,
                contact or course deletes it from your account.
              </>,
              <>
                <strong className="text-foreground">Delete your account:</strong> Profile, then
                Delete account, removes your account, all of the data above, and your uploaded
                files. This cannot be undone.
              </>,
            ]}
          />
        </Section>

        <p className="border-t border-border/60 pt-6 text-xs text-muted-foreground">
          This page describes how the app works today. It will be updated if that changes.
        </p>
      </main>
    </div>
  );
}
