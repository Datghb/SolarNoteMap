export function normalizeClassCode(value: string) {
  return value.trim();
}

export function canSubmitClassCode(value: string) {
  const code = normalizeClassCode(value);
  return /^[A-Za-z0-9_-]{8,64}$/.test(code);
}
