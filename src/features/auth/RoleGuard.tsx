import React from 'react';
import type { UserRole } from '../../types';
import { ShieldAlert } from 'lucide-react';

interface RoleGuardProps {
  userRole?: UserRole;
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ userRole, allowedRoles, children }) => {
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto my-12">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-red-900">Access Restricted</h3>
        <p className="text-xs text-red-700 mt-2">
          Your current role (<strong>{userRole || 'ANONYMOUS'}</strong>) does not have permission to
          view or manage this section.
        </p>
        <p className="text-xs text-red-500 mt-1">Required roles: {allowedRoles.join(', ')}.</p>
      </div>
    );
  }

  return <>{children}</>;
};
