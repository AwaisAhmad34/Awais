/**
 * Shared accounting number formatting helpers.
 * Negative values are always formatted in accounting parentheses, e.g. -1,250.00 -> (1,250.00).
 */

export function formatAccountingNumber(
  value: number | null | undefined,
  options: { decimals?: number; emptyZero?: boolean } = {}
): string {
  const decimals = options.decimals ?? 2;
  const num = Number(value) || 0;
  const threshold = decimals === 0 ? 0.5 : 0.005;

  if (Math.abs(num) < threshold) {
    if (options.emptyZero) return '-';
    return decimals === 0
      ? '0'
      : (0).toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
  }

  const formattedAbs = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return num < 0 ? `(${formattedAbs})` : formattedAbs;
}

export function formatAccountingInteger(value: number | null | undefined): string {
  const rounded = Math.round(Number(value) || 0);
  if (rounded === 0) return '0';
  const formattedAbs = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `(${formattedAbs})` : formattedAbs;
}

export function formatAccountingPKR(
  value: number | null | undefined,
  prefix = 'Rs. ',
  decimals = 0
): string {
  const num = Number(value) || 0;
  const formatted = formatAccountingNumber(num, { decimals });
  return prefix ? `${prefix}${formatted}` : formatted;
}
