import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NoticeProps {
  type?: 'error' | 'warning' | 'success';
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export const Notice: React.FC<NoticeProps> = ({
  type = 'error',
  message,
  onDismiss,
  className = '',
}) => {
  if (!message) return null;

  const getStyle = () => {
    switch (type) {
      case 'warning':
        return 'bg-amber-50 border-amber-300 text-amber-900';
      case 'success':
        return 'bg-emerald-50 border-emerald-300 text-emerald-900';
      case 'error':
      default:
        return 'bg-rose-50 border-rose-300 text-rose-900';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />;
      case 'error':
      default:
        return <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />;
    }
  };

  return (
    <div
      role="alert"
      className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs leading-relaxed ${getStyle()} ${className}`}
    >
      <div className="flex items-start gap-2.5">
        {getIcon()}
        <span className="font-medium whitespace-pre-wrap">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs font-bold underline shrink-0 hover:opacity-75"
          type="button"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};
