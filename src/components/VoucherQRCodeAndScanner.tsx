import React, { useEffect, useState, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Camera,
  Search,
  CheckCircle2,
  Printer,
  Copy,
  X,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Transaction, Campus, useAccounting } from '../core/aplusEngine';

export function buildVoucherQrPayload(voucher: Transaction, campus?: Campus): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://aplus-erp.app';
  const txId = String(voucher.id || voucher.voucherNo || 'UNASSIGNED');
  const vNo = String(voucher.voucherNo || '');
  const vType = String(voucher.voucherType || 'BPV');
  const cCode = String(campus?.code || voucher.campusId || 'MAIN');
  const amt = Number(voucher.totalDebit || voucher.totalCredit || 0);
  return `${origin}/?voucherId=${encodeURIComponent(txId)}&voucherNo=${encodeURIComponent(
    vNo
  )}&type=${encodeURIComponent(vType)}&campus=${encodeURIComponent(cCode)}&amt=${amt}`;
}

export function extractVoucherIdentifierFromScan(rawInput: string): {
  voucherId?: string;
  voucherNo?: string;
  rawClean: string;
} {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return { rawClean: '' };

  // Check if URL with ?voucherId=...&voucherNo=...
  try {
    if (trimmed.includes('voucherId=') || trimmed.includes('voucherNo=')) {
      const urlObj = new URL(
        trimmed.startsWith('http')
          ? trimmed
          : `https://placeholder.local/${trimmed.replace(/^\//, '')}`
      );
      const voucherId = urlObj.searchParams.get('voucherId') || undefined;
      const voucherNo = urlObj.searchParams.get('voucherNo') || undefined;
      return {
        voucherId,
        voucherNo,
        rawClean: voucherId || voucherNo || trimmed,
      };
    }
  } catch {}

  // Check structured format ID:...|NO:...
  const idMatch = trimmed.match(/ID:([^|\s&]+)/i);
  const noMatch = trimmed.match(/NO:([^|\s&]+)/i);
  if (idMatch || noMatch) {
    return {
      voucherId: idMatch?.[1],
      voucherNo: noMatch?.[1],
      rawClean: idMatch?.[1] || noMatch?.[1] || trimmed,
    };
  }

  return {
    voucherId: trimmed,
    voucherNo: trimmed,
    rawClean: trimmed,
  };
}

export const VoucherQRCodeBadge: React.FC<{
  voucher: Transaction;
  campus?: Campus;
  size?: number;
}> = ({ voucher, campus, size = 84 }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const payload = useMemo(
    () => buildVoucherQrPayload(voucher, campus),
    [voucher.id, voucher.voucherNo, voucher.voucherType, voucher.totalDebit, campus?.code]
  );

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(payload, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [payload, size]);

  const handleCopyId = () => {
    try {
      navigator.clipboard.writeText(String(voucher.id || voucher.voucherNo));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="border-2 border-black bg-white p-1.5 flex flex-col items-center justify-center text-center shrink-0">
      <div className="text-[8px] font-black uppercase tracking-wider text-black border-b border-black w-full pb-0.5 mb-1">
        Scan to Verify & Retrieve
      </div>
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt={`QR Code for Voucher ${voucher.voucherNo} (${voucher.id})`}
          style={{ width: `${size}px`, height: `${size}px` }}
          className="block object-contain"
        />
      ) : (
        <div
          style={{ width: `${size}px`, height: `${size}px` }}
          className="flex items-center justify-center bg-slate-100 text-[9px] font-mono"
        >
          QR
        </div>
      )}
      <div className="mt-1 text-[8px] font-mono font-bold text-black leading-tight max-w-[110px] truncate">
        ID: {voucher.id || voucher.voucherNo}
      </div>
      <button
        type="button"
        onClick={handleCopyId}
        data-no-print="true"
        className="print:hidden mt-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[9px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
        title="Copy Unique Transaction ID for quick retrieval"
      >
        <Copy className="w-2.5 h-2.5" />
        <span>{copied ? 'Copied ID!' : 'Copy Tx ID'}</span>
      </button>
    </div>
  );
};

export const VoucherQRScannerAndRetrievalModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onOpenInA4Studio?: (voucher: Transaction) => void;
}> = ({ isOpen, onClose, onOpenInA4Studio }) => {
  const { transactions, campuses } = useAccounting();
  const [scanInput, setScanInput] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('voucherId') || params.get('voucherNo')) {
        return window.location.href;
      }
    } catch {}
    return '';
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  // Stop camera helper
  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCameraScan = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera API is not available in this browser context. Paste or scan the QR payload / Transaction ID in the input box below.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const BarcodeDetectorApi = (window as any).BarcodeDetector;
      if (BarcodeDetectorApi) {
        const detector = new BarcodeDetectorApi({ formats: ['qr_code'] });
        const tick = async () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes.length > 0 && codes[0].rawValue) {
                setScanInput(codes[0].rawValue);
                stopCamera();
                return;
              }
            } catch {}
          }
          scanLoopRef.current = requestAnimationFrame(tick);
        };
        scanLoopRef.current = requestAnimationFrame(tick);
      }
    } catch {
      setCameraError(
        'Camera permission was denied or no camera was detected. Use a handheld QR scanner or enter/paste the Transaction ID below.'
      );
      setCameraActive(false);
    }
  };

  const matchedVoucher = useMemo(() => {
    const { voucherId, voucherNo, rawClean } = extractVoucherIdentifierFromScan(scanInput);
    if (!rawClean) return null;
    const qId = (voucherId || '').toLowerCase();
    const qNo = (voucherNo || '').toLowerCase();
    const qRaw = rawClean.toLowerCase();

    return (
      (transactions || []).find(
        (tx) =>
          String(tx.id || '').toLowerCase() === qId ||
          String(tx.voucherNo || '').toLowerCase() === qNo ||
          String(tx.id || '').toLowerCase() === qRaw ||
          String(tx.voucherNo || '').toLowerCase() === qRaw ||
          String(tx.id || '').toLowerCase().includes(qRaw) ||
          String(tx.voucherNo || '').toLowerCase().includes(qRaw)
      ) || null
    );
  }, [scanInput, transactions]);

  if (!isOpen) return null;

  const matchedCampus = matchedVoucher
    ? campuses.find((c) => c.id === matchedVoucher.campusId)
    : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 print:hidden">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                App-Based Voucher QR Scanner & Instant Retrieval
              </span>
              <h2 className="text-base font-black text-white">
                Scan Printed Voucher QR Code or Enter Unique Transaction ID
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Scanner Input & Camera Controls */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-600" />
                <span>Scan QR Payload, Unique Transaction ID, or Voucher Number:</span>
              </label>

              <button
                type="button"
                onClick={() => (cameraActive ? stopCamera() : startCameraScan())}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  cameraActive
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{cameraActive ? 'Stop Camera Scanner' : 'Start Camera QR Scanner'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                autoFocus
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Point handheld QR scanner here, or paste Transaction ID / Voucher No (e.g. tx-... or BPV-001)..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
              {scanInput && (
                <button
                  type="button"
                  onClick={() => setScanInput('')}
                  className="px-3 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {cameraActive && (
              <div className="rounded-xl overflow-hidden border-2 border-emerald-500 bg-black relative max-w-sm mx-auto">
                <video ref={videoRef} className="w-full h-52 object-cover" playsInline muted />
                <div className="bg-slate-900/90 text-emerald-300 text-[11px] font-mono py-1.5 px-3 text-center">
                  Align printed voucher QR code inside camera frame...
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Quick-Test Voucher QR Chips */}
            {(transactions || []).length > 0 && (
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">
                  Quick Simulate QR Scan from Ledger:
                </span>
                {(transactions || []).slice(0, 6).map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => setScanInput(buildVoucherQrPayload(tx))}
                    className="px-2 py-1 rounded-md bg-white hover:bg-emerald-50 border border-slate-300 hover:border-emerald-400 font-mono font-bold text-[11px] text-slate-800 flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3 h-3 text-emerald-600" />
                    <span>{tx.voucherNo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Retrieved Voucher Card */}
          {matchedVoucher ? (
            <div className="border-2 border-emerald-500 rounded-2xl bg-white overflow-hidden shadow-sm">
              <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                      QR Code Authentic & Verified in Master Ledger
                    </div>
                    <div className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span className="font-mono text-emerald-800">{matchedVoucher.voucherNo}</span>
                      <span>·</span>
                      <span>{matchedVoucher.voucherType}</span>
                      <span className="text-xs font-mono font-normal text-slate-500">
                        (Tx ID: {matchedVoucher.id})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onOpenInA4Studio && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenInA4Studio(matchedVoucher);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Open A4 Print Voucher (with QR)</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-9 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Campus</div>
                      <div className="font-bold text-slate-900 truncate">
                        {matchedCampus?.name || matchedVoucher.campusId}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Date</div>
                      <div className="font-mono font-bold text-slate-900">
                        {matchedVoucher.date}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Status</div>
                      <div className="font-bold text-emerald-700">
                        {matchedVoucher.status || 'Posted'}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        Total Amount
                      </div>
                      <div className="font-mono font-black text-slate-900">
                        PKR {(matchedVoucher.totalDebit || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="font-bold text-slate-700">Narration: </span>
                    <span className="text-slate-900">{matchedVoucher.narration}</span>
                  </div>

                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-bold text-slate-800">
                        <th className="border border-slate-300 p-1.5 text-left">Acc Code</th>
                        <th className="border border-slate-300 p-1.5 text-left">Account Head</th>
                        <th className="border border-slate-300 p-1.5 text-right">Debit (PKR)</th>
                        <th className="border border-slate-300 p-1.5 text-right">Credit (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(matchedVoucher.entries || []).map((ent, i) => (
                        <tr key={i} className="border-b border-slate-200">
                          <td className="border border-slate-300 p-1.5 font-mono font-bold">
                            {ent.accountCode}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-semibold">
                            {ent.accountName}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {ent.debit > 0 ? ent.debit.toLocaleString() : '-'}
                          </td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">
                            {ent.credit > 0 ? ent.credit.toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:col-span-3 flex flex-col items-center justify-center">
                  <VoucherQRCodeBadge
                    voucher={matchedVoucher}
                    campus={matchedCampus}
                    size={104}
                  />
                </div>
              </div>
            </div>
          ) : scanInput.trim() ? (
            <div className="p-6 rounded-xl border border-rose-200 bg-rose-50 text-center text-rose-900 space-y-1">
              <div className="font-black text-sm">
                No Voucher Found Matching "{scanInput.trim()}"
              </div>
              <p className="text-xs text-rose-700">
                Verify the Unique Transaction ID or Voucher Number on the printed voucher and try again.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
