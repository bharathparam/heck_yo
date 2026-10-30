import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Download, X, Share2, Smartphone } from 'lucide-react';

export const InstallBanner: React.FC = () => {
  const { showInstallBanner, dismissInstallBanner, triggerInstall, t } = useApp();
  const [showIOSModal, setShowIOSModal] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  if (!showInstallBanner) return null;

  return (
    <>
      <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50 bg-[#0B1F33] text-white p-4 rounded-2xl shadow-xl border border-[#D9E1EA]/20 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
        <div className="w-10 h-10 rounded-xl bg-[#F5A524] text-[#0B1F33] flex items-center justify-center shrink-0 mt-0.5">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-[14px] text-white leading-tight">{t.install.bannerTitle}</h4>
          <p className="text-[12px] text-[#A0B0C0] mt-1 leading-snug">{t.install.bannerDesc}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                if (isIOS) {
                  setShowIOSModal(true);
                } else {
                  triggerInstall();
                }
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#F5A524] text-[#0B1F33] font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-transform"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.install.installBtn}</span>
            </button>
            <button
              onClick={dismissInstallBanner}
              className="px-3 py-1.5 rounded-xl bg-white/10 text-white font-medium text-xs hover:bg-white/20 active:scale-95 transition-transform"
            >
              {t.install.dismissBtn}
            </button>
          </div>
        </div>
        <button
          onClick={dismissInstallBanner}
          className="text-[#A0B0C0] hover:text-white p-1"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* iOS Modal Helper */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white text-[#0B1F33] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{t.install.iosTitle}</h3>
              <button onClick={() => setShowIOSModal(false)} className="p-1 text-gray-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {t.install.iosDesc}
            </p>
            <div className="flex items-center gap-3 p-3 bg-[#F3F6FA] rounded-2xl border border-[#D9E1EA]">
              <Share2 className="w-6 h-6 text-[#0B1F33] shrink-0" />
              <span className="text-xs text-gray-700 font-medium">Tap <strong>Share</strong> in Safari &rarr; select <strong>Add to Home Screen</strong></span>
            </div>
            <button
              onClick={() => {
                setShowIOSModal(false);
                dismissInstallBanner();
              }}
              className="w-full h-12 rounded-xl bg-[#0B1F33] text-white font-bold text-sm active:scale-95 transition-transform"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
