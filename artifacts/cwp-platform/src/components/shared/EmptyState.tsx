import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center" data-testid="empty-state">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 text-white/40">
        {icon ?? <Inbox size={20} />}
      </div>
      <h3 className="text-white font-medium">{title}</h3>
      {description && <p className="text-white/50 text-sm mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
