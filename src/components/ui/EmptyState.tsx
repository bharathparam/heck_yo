import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, action, icon }) => {
  return (
    <div className="p-8 text-center bg-white rounded-2xl border border-[#D9E1EA] space-y-3">
      <div className="w-12 h-12 rounded-full bg-[#F3F6FA] border border-[#D9E1EA] flex items-center justify-center text-[#74777d] mx-auto">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-base text-[#0B1F33]">{title}</h3>
        <p className="text-xs text-[#74777d] max-w-sm mx-auto">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
