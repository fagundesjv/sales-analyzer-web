const cnpjLength = 14;

export function normalizeCnpj(value: string) {
  return value.toLocaleUpperCase("pt-BR").replace(/[^0-9A-Z]/g, "");
}

export function formatCnpj(value: string) {
  const normalized = normalizeCnpj(value).slice(0, cnpjLength);
  const parts = [
    normalized.slice(0, 2),
    normalized.slice(2, 5),
    normalized.slice(5, 8),
    normalized.slice(8, 12),
    normalized.slice(12, 14),
  ];
  let formatted = parts[0];
  if (parts[1]) formatted += `.${parts[1]}`;
  if (parts[2]) formatted += `.${parts[2]}`;
  if (parts[3]) formatted += `/${parts[3]}`;
  if (parts[4]) formatted += `-${parts[4]}`;
  return formatted;
}

function verificationDigit(value: string) {
  const weights = value.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = [...value].reduce((total, character, index) => (
    total + (character.charCodeAt(0) - 48) * weights[index]!
  ), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string) {
  const normalized = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(normalized)) return false;
  if (/^(\d)\1{13}$/.test(normalized)) return false;
  const base = normalized.slice(0, 12);
  const firstDigit = verificationDigit(base);
  const secondDigit = verificationDigit(`${base}${firstDigit}`);
  return normalized.endsWith(`${firstDigit}${secondDigit}`);
}
