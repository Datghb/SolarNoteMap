interface ClipboardWriter {
  writeText: (text: string) => Promise<void>;
}

export async function copyTextToClipboard(text: string, clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard) {
  if (!text.trim()) throw new Error('Không có mã để sao chép.');
  if (!clipboard?.writeText) throw new Error('Trình duyệt không hỗ trợ sao chép tự động.');
  await clipboard.writeText(text);
}
