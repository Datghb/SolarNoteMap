export function isExpiredPdfAccessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:response|status).*\b(?:400|401|403)\b/i.test(message);
}

export function getSafePdfErrorMessage(error: unknown) {
  if (isExpiredPdfAccessError(error)) {
    return 'Liên kết tài liệu đã hết hạn. Hệ thống đang yêu cầu liên kết mới.';
  }
  const message = error instanceof Error ? error.message : '';
  return message && !message.includes('http')
    ? message
    : 'Không thể tải tài liệu PDF lúc này.';
}
