import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-8 px-4">
      <div className="h-12 w-12 rounded-full bg-gradient-brand text-white flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(91,61,245,0.6)] ring-4 ring-primary/10">
        {icon}
      </div>
      <div>
        <p className="text-label text-foreground">{title}</p>
        {description && <p className="text-caption text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-1 rounded-full bg-gradient-brand text-white text-label px-5 py-2 shadow-[0_10px_30px_-10px_rgba(91,61,245,0.8)] transition-transform hover:scale-[1.03] active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
