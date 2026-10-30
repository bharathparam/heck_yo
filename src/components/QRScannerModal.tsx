import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, KeyRound, AlertTriangle } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  isProcessing: boolean;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  isProcessing,
}) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen || showManualInput) {
      cleanupScanner();
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        setCameraError(null);
        const html5QrCode = new Html5Qrcode(readerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minDim = Math.min(viewfinderWidth, viewfinderHeight);
              return {
                width: Math.floor(minDim * 0.75),
                height: Math.floor(minDim * 0.75),
              };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
            }
          },
          () => {
            // Frame failed to detect QR, silence periodic logs
          }
        );
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Unable to access device camera';
        setCameraError(
          msg.includes('NotAllowedError') || msg.includes('Permission')
            ? 'Camera access denied. Please grant permission in browser settings or use manual entry.'
            : 'Could not open camera stream. Switching to manual ticket entry.'
        );
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      cleanupScanner();
    };
  }, [isOpen, facingMode, showManualInput]);

  const cleanupScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current
        .stop()
        .then(() => scannerRef.current?.clear())
        .catch(() => {});
    }
  };

  const toggleCameraFacing = () => {
    cleanupScanner();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScanSuccess(manualCode.trim());
      setManualCode('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh] pb-safe">
        {/* Mobile Drag Indicator Bar */}
        <div className="w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto mt-3 sm:hidden shrink-0"></div>

        {/* Modal Top Bar */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Boarding Pass Scanner</h3>
              <p className="text-[11px] text-slate-400">Position passenger QR inside reticle</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tap-target w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera / Manual Viewport Area */}
        <div className="relative bg-black flex items-center justify-center overflow-hidden min-h-[260px] sm:min-h-[300px]">
          {showManualInput ? (
            <div className="p-6 w-full max-w-xs mx-auto text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-sky-400 flex items-center justify-center mx-auto">
                <KeyRound className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Manual Reference Entry</h4>
                <p className="text-xs text-slate-400">
                  Enter Ticket Reference (e.g. TKT-52C1B818) or Ticket UUID
                </p>
              </div>
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. TKT-52C1B818"
                  autoFocus
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-center font-mono text-sm text-sky-300 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  disabled={isProcessing || !manualCode.trim()}
                  className="w-full tap-target bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs active-press transition-all"
                >
                  {isProcessing ? 'Verifying...' : 'Confirm Ticket Boarding'}
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* HTML5 QR Code Container */}
              <div id={readerElementId} className="w-full h-full max-w-sm"></div>

              {/* Viewfinder Target Overlays */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-52 h-52">
                  {/* Four Corner Brackets */}
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>

                  {/* Animated laser scan line */}
                  <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scanline shadow-[0_0_12px_#34d399]"></div>
                </div>
              </div>

              {cameraError && (
                <div className="absolute inset-4 bg-slate-950/95 border border-amber-800/80 p-5 rounded-2xl text-center space-y-3 z-10 flex flex-col justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-xs text-amber-200 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="tap-target px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-xl text-xs font-semibold mx-auto"
                  >
                    Switch to Manual Entry
                  </button>
                </div>
              )}
            </>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-sky-400 font-semibold text-xs z-20">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <span>Verifying Ticket & Boarding...</span>
            </div>
          )}
        </div>

        {/* Modal Bottom Controls */}
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowManualInput(!showManualInput)}
            className="tap-target flex-1 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-xl flex items-center justify-center gap-1.5 active-press transition-colors"
          >
            <KeyRound className="w-4 h-4 text-sky-400" />
            <span>{showManualInput ? 'Open Camera' : 'Manual Entry'}</span>
          </button>

          {!showManualInput && (
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="tap-target px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-xl flex items-center justify-center gap-1.5 active-press transition-colors"
              title="Flip camera"
            >
              <RefreshCw className="w-4 h-4 text-slate-400" />
              <span className="hidden xs:inline">Flip</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="tap-target px-4 py-2 text-xs font-bold text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-750 active-press border border-slate-700/80"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
