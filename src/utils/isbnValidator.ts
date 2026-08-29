/**
 * ISBN-13 & EAN-13 Barcode Validation & Normalization Utilities
 */

/**
 * Validates whether the given string is a valid ISBN-13 (or EAN-13 for books).
 * 1. Must contain exactly 13 digits (after stripping hyphens/spaces).
 * 2. Must satisfy the EAN-13 / ISBN-13 check digit algorithm:
 *    sum = (1*d1 + 3*d2 + 1*d3 + 3*d4 + ... + 1*d11 + 3*d12)
 *    checkDigit = (10 - (sum % 10)) % 10
 *    checkDigit === d13
 */
export function isValidIsbn13(raw: string): boolean {
  if (!raw) return false;
  const clean = raw.replace(/[^0-9]/g, '').trim();
  if (clean.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  const actualCheckDigit = parseInt(clean[12], 10);

  return expectedCheckDigit === actualCheckDigit;
}

/**
 * Validates whether the given string is a valid ISBN-10.
 * sum = (10*d1 + 9*d2 + 8*d3 + ... + 2*d9 + 1*d10) % 11 === 0 (where d10 can be 'X' representing 10).
 */
export function isValidIsbn10(raw: string): boolean {
  if (!raw) return false;
  const clean = raw.replace(/[^0-9X]/gi, '').toUpperCase().trim();
  if (clean.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean[i], 10) * (10 - i);
  }
  const lastChar = clean[9];
  const lastDigit = lastChar === 'X' ? 10 : parseInt(lastChar, 10);
  sum += lastDigit;

  return sum % 11 === 0;
}

/**
 * Converts a valid 10-digit ISBN into a standard 13-digit ISBN (978-prefix).
 */
export function convertIsbn10To13(isbn10: string): string | null {
  const clean = isbn10.replace(/[^0-9X]/gi, '').toUpperCase().trim();
  if (clean.length !== 10) return null;

  const base = '978' + clean.substring(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  const isbn13 = base + checkDigit;

  return isValidIsbn13(isbn13) ? isbn13 : null;
}

/**
 * Normalizes any raw scanned or manually inputted ISBN string into a strictly validated 13-digit ISBN.
 * Returns the 13-digit ISBN if valid, or null if it fails ISBN-13 / ISBN-10 validation.
 */
export function cleanAndValidateIsbn(raw: string): {
  isValid: boolean;
  isbn13: string;
  originalClean: string;
  errorReason?: string;
} {
  if (!raw) {
    return { isValid: false, isbn13: '', originalClean: '', errorReason: 'ISBN 값이 비어있습니다.' };
  }

  const cleanDigits = raw.replace(/[^0-9X]/gi, '').trim();

  // Case 1: 13 digits
  if (cleanDigits.length === 13) {
    if (isValidIsbn13(cleanDigits)) {
      return { isValid: true, isbn13: cleanDigits, originalClean: cleanDigits };
    } else {
      return {
        isValid: false,
        isbn13: cleanDigits,
        originalClean: cleanDigits,
        errorReason: '13자리 바코드이지만 ISBN-13 체크 디지트 검증에 실패했습니다.',
      };
    }
  }

  // Case 2: 10 digits (ISBN-10)
  if (cleanDigits.length === 10) {
    if (isValidIsbn10(cleanDigits)) {
      const converted = convertIsbn10To13(cleanDigits);
      if (converted) {
        return { isValid: true, isbn13: converted, originalClean: cleanDigits };
      }
    }
    return {
      isValid: false,
      isbn13: '',
      originalClean: cleanDigits,
      errorReason: '10자리 ISBN 검증 또는 변환에 실패했습니다.',
    };
  }

  return {
    isValid: false,
    isbn13: cleanDigits,
    originalClean: cleanDigits,
    errorReason: `ISBN은 13자리여야 합니다. (현재: ${cleanDigits.length}자리)`,
  };
}
