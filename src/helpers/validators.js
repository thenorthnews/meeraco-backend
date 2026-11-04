export const isEmail = (str) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim());
};

export const isPhone = (str) => {
  return /^[6-9]\d{9}$/.test(String(str).replace(/[\s-]/g, ''));
};

export const isGSTIN = (str) => {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(String(str).trim().toUpperCase());
};

