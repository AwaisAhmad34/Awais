import React, { useMemo, useState } from 'react';
import { QrCode, CheckCircle, ShieldCheck, Copy, Check } from 'lucide-react';
import { Transaction, Campus } from '../core/aplusEngine';

export interface VoucherQRCodeBadgeProps {
  voucher: Transaction & {
    createdBy?: string;
    approvedAt?: string;
  };
  campus?: Campus;
  size?: number;
  className?: string;
}

/**
 * Deterministic pseudo QR pattern generator for voucher verification & rapid scanning
 */
function generateVoucherHash(voucher: Transaction): string {
  const raw = `${voucher.voucherNo || voucher.id}|${voucher.campusId}|${voucher.date}|${voucher.totalDebit}|${voucher.voucherType}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

export const VoucherQRCodeBadge: React.FC<VoucherQRCodeBadgeProps> = ({
  voucher,
  campus,
  size = 74,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const voucherHash = useMemo(() => generateVoucherHash(voucher), [voucher]);
  const verificationPayload = useMemo(() => {
    return JSON.stringify({
      vNo: voucher.voucherNo || voucher.id,
      type: voucher.voucherType,
      date: voucher.date,
      amount: voucher.totalDebit,
      campus: campus?.name || voucher.campusId,
      status: voucher.status,
      hash: voucherHash,
    });
  }, [voucher, campus, voucherHash]);

  // Deterministic SVG matrix generator for visual QR code pattern
  const matrix = useMemo(() => {
    const gridSize = 19;
    const grid: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

    // Corner Finder Patterns
    const setFinder = (startX: number, startY: number) => {
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if (
            r === 0 ||
            r === 6 ||
            c === 0 ||
            c === 6 ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            grid[startY + r][startX + c] = true;
          }
        }
      }
    };

    setFinder(0, 0);
    setFinder(gridSize - 7, 0);
    setFinder(0, gridSize - 7);

    // Timing strips
    for (let i = 8; i < gridSize - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Hash-based data cells
    let bitIdx = 0;
    const hashStr = voucherHash + (voucher.voucherNo || '') + voucher.date;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        // Skip finder regions
        const isFinderTopLeft = r < 8 && c < 8;
        const isFinderTopRight = r < 8 && c >= gridSize - 8;
        const isFinderBottomLeft = r >= gridSize - 8 && c < 8;
        if (!isFinderTopLeft && !isFinderTopRight && !isFinderBottomLeft) {
          const char = hashStr.charCodeAt(bitIdx % hashStr.length);
          grid[r][c] = (char ^ (r * 7 + c * 13)) % 2 === 0;
          bitIdx++;
        }
      }
    }

    return grid;
  }, [voucherHash, voucher.voucherNo, voucher.date]);

  const handleCopyHash = () => {
    navigator.clipboard?.writeText?.(verificationPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div
        className={`inline-flex flex-col items-center justify-center p-1.5 bg-white border border-black rounded cursor-pointer hover:bg-slate-50 transition-colors select-none ${className}`}
        style={{ width: `${size + 14}px` }}
        onClick={() => setShowModal(true)}
        title={`Scan or Click to Verify Voucher ${voucher.voucherNo || voucher.id}`}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 19 19"
          className="shape-rendering-crispEdges text-black"
        >
          {matrix.map((row, r) =>
            row.map((filled, c) =>
              filled ? (
                <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />
              ) : null
            )
          )}
        </svg>

        <div className="mt-1 text-[8px] font-mono font-bold text-black tracking-tight flex items-center gap-0.5 uppercase">
          <span>VERIFY #{voucherHash.slice(0, 4)}</span>
        </div>
      </div>

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs print:hidden"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Digital Voucher Verification</h3>
                  <p className="text-[11px] text-slate-500 font-mono">Secured Audit Hash</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <svg width={140} height={140} viewBox="0 0 19 19" className="text-black">
                {matrix.map((row, r) =>
                  row.map((filled, c) =>
                    filled ? (
                      <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />
                    ) : null
                  )
                )}
              </svg>
              <div className="mt-2 text-xs font-mono font-bold text-slate-700">
                AUTH TOKEN: {voucherHash}
              </div>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Voucher No:</span>
                <span className="font-mono font-bold text-slate-900">{voucher.voucherNo || voucher.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Type:</span>
                <span className="font-bold text-slate-900">{voucher.voucherType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Amount (PKR):</span>
                <span className="font-mono font-bold text-emerald-700">
                  Rs. {Math.round(voucher.totalDebit || 0).toLocaleString('en-PK')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Campus:</span>
                <span className="font-semibold text-slate-900">{campus?.name || voucher.campusId}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="font-semibold text-slate-500">Date:</span>
                <span className="font-semibold text-slate-900">{voucher.date}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-500">Status:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {voucher.status || 'Verified'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={handleCopyHash}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Payload Copied!' : 'Copy Verification QR'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
