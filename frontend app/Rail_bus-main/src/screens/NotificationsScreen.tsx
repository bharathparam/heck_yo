import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Bell, CheckCircle, Bus, Clock, ShieldAlert, AlertTriangle } from 'lucide-react';

export const NotificationsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, markNotificationRead } = useApp();

  const getIcon = (kind: string) => {
    switch (kind) {
      case 'TICKET_CONFIRMED':
      case 'TRIP_APPROVED':
        return <CheckCircle className="w-5 h-5 text-[#0B7A55]" />;
      case 'BUS_ASSIGNED':
        return <Bus className="w-5 h-5 text-[#0B1F33]" />;
      case 'DISPATCH_REQUIRED':
      case 'THRESHOLD_REACHED':
        return <Clock className="w-5 h-5 text-[#B76E00]" />;
      case 'WAITING_DISPATCH':
        return <Clock className="w-5 h-5 text-[#B76E00]" />;
      case 'SERVICE_CANCELLED':
        return <ShieldAlert className="w-5 h-5 text-[#D32F2F]" />;
      default:
        return <Bell className="w-5 h-5 text-[#0B1F33]" />;
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-4 pb-28 pt-20 px-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-[#D9E1EA] flex items-center justify-center text-[#0B1F33] active:scale-95 transition-transform shadow-sm"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-xl text-[#0B1F33] tracking-tight">
          Notifications
        </h1>
        <div className="w-10" />
      </div>

      <p className="text-xs text-[#74777d]">
        Updates for seat reservation, threshold progress, bus dispatch, and cancellations.
      </p>

      {/* Notifications List */}
      <div className="space-y-3">
        {notifications.map((notif) => {
          const isUnread = !notif.read_at;
          const formattedTime = notif.created_at
            ? new Date(notif.created_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <div
              key={notif.id}
              onClick={() => {
                markNotificationRead(notif.id);
                if (notif.trip_id) navigate('/tickets');
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm space-y-2 ${
                isUnread ? 'bg-[#EBF2FA] border-[#0B1F33]/20 ring-1 ring-[#0B1F33]/20' : 'bg-white border-[#D9E1EA]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-[#D9E1EA] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  {getIcon(notif.kind)}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[#0B1F33] leading-tight">{notif.title}</h3>
                    <span className="text-[10px] text-[#74777d]">{formattedTime}</span>
                  </div>
                  <p className="text-xs text-[#44474c] leading-relaxed">{notif.message}</p>
                </div>
              </div>
            </div>
          );
        })}

        {notifications.length === 0 && (
          <div className="rounded-2xl border border-[#D9E1EA] bg-white p-8 text-center text-sm text-[#74777d] space-y-2">
            <Bell className="w-8 h-8 mx-auto text-[#74777d]/40" />
            <p className="font-bold text-[#0B1F33]">No notifications yet</p>
            <p className="text-xs">Demand updates, ticket issuances, and refund notices will be delivered here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
