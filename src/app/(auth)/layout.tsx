import Logo from '@/components/layout/Logo';

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex items-center gap-2 mb-8">
        <Logo className="h-10 w-10" />
        <span className="text-lg font-bold text-foreground">Syllabus Sense</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
