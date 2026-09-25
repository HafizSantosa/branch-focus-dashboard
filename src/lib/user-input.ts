import { VALID_COMPANIES, type Company } from "./companies";

export { VALID_COMPANIES, type Company };
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,32}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (USERNAME_PATTERN.test(username)) return null;
  return "Username harus 3-32 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung.";
}

export function validateEmail(email: string): string | null {
  return EMAIL_PATTERN.test(email) ? null : "Format email tidak valid.";
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    return `Password maksimal ${PASSWORD_MAX_BYTES} byte.`;
  }
  return null;
}

export function validateCompany(company?: string): string | null {
  if (!company || !VALID_COMPANIES.includes(company as Company)) {
    return "Pilih perusahaan yang valid.";
  }
  return null;
}
