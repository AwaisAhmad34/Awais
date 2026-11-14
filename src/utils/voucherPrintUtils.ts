import { useState, useEffect, useCallback } from 'react';

export interface MinimalCampusLike {
  id?: string;
  code?: string;
  name?: string;
}

export interface MinimalOrgSettingsLike {
  schoolName?: string;
}

export interface ResolvedVoucherCampusInfo {
  campusName: string;
  campusCode: string;
  schoolName: string;
  campusDisplayLabel: string;
}

/**
 * Formats an exact timestamp string for print request headers & footers (Date + Time with seconds).
 */
export function formatPrintRequestTimestamp(dateInput: Date | string = new Date()): string {
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) {
      return new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
}

/**
 * Resolves the authoritative school campus name, code, and organization name for a voucher.
 */
export function resolveVoucherCampusInfo(params: {
  voucher?: { campusId?: string | null } | null;
  campus?: MinimalCampusLike | null;
  campuses?: MinimalCampusLike[];
  currentCampusId?: string | null;
  orgSettings?: MinimalOrgSettingsLike | null;
}): ResolvedVoucherCampusInfo {
  const { voucher, campus, campuses = [], currentCampusId, orgSettings } = params;

  const matchedCampus =
    (campus && (campus.name || campus.code) ? campus : null) ||
    (voucher?.campusId ? campuses.find((c) => c.id === voucher.campusId) : undefined) ||
    (currentCampusId && currentCampusId !== 'all'
      ? campuses.find((c) => c.id === currentCampusId)
      : undefined) ||
    campuses[0] ||
    null;

  const rawCampusName = matchedCampus?.name || (voucher?.campusId ? String(voucher.campusId) : 'Main Campus');
  const cleanedCampusName = rawCampusName
    .replace(/A\+\s*School\s*System\s*\(?|\)?/gi, '')
    .trim() || rawCampusName;

  const campusCode = (matchedCampus?.code || 'CAMPUS').toUpperCase();
  const schoolName = (orgSettings?.schoolName || 'A+ School System').trim();
  const campusDisplayLabel = matchedCampus?.code
    ? `${cleanedCampusName} (${campusCode})`
    : cleanedCampusName;

  return {
    campusName: cleanedCampusName,
    campusCode,
    schoolName,
    campusDisplayLabel,
  };
}

/**
 * React hook that maintains a live print request timestamp and automatically refreshes it
 * whenever browser `beforeprint` fires or when `refreshPrintTimestamp()` is called before printing.
 */
export function usePrintRequestTimestamp(externalTimestamp?: string) {
  const [internalTimestamp, setInternalTimestamp] = useState<string>(() =>
    externalTimestamp || formatPrintRequestTimestamp()
  );

  const refreshPrintTimestamp = useCallback((): string => {
    const fresh = formatPrintRequestTimestamp();
    setInternalTimestamp(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (externalTimestamp) {
      setInternalTimestamp(externalTimestamp);
      return;
    }
    if (typeof window === 'undefined') return;
    const handleBeforePrint = () => {
      setInternalTimestamp(formatPrintRequestTimestamp());
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    };
  }, [externalTimestamp]);

  return {
    printTimestamp: externalTimestamp || internalTimestamp,
    refreshPrintTimestamp,
  };
}
