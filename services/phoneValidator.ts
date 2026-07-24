/**
 * Cleans phone number by stripping all non-numeric characters.
 * If the cleaned number has 11 digits and starts with '1', it removes the leading '1'.
 */
export const cleanPhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
};

/**
 * Formats a phone number string on-the-fly into (XXX) XXX-XXXX.
 */
export const formatPhoneInput = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const digitsLength = digits.length;
  
  // Handle leading country code '1' if typed
  let cleanDigits = digits;
  if (digitsLength > 10 && digits.startsWith('1')) {
    cleanDigits = digits.slice(1);
  }

  const cleanLength = cleanDigits.length;

  if (cleanLength === 0) return '';
  if (cleanLength < 4) return cleanDigits;
  if (cleanLength < 7) {
    return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3)}`;
  }
  return `(${cleanDigits.slice(0, 3)}) ${cleanDigits.slice(3, 6)}-${cleanDigits.slice(6, 10)}`;
};

/**
 * Validates whether the given string contains exactly 10 digits after cleaning.
 */
export const isValidPhoneNumber = (value: string): boolean => {
  const clean = cleanPhoneNumber(value);
  return clean.length === 10;
};
