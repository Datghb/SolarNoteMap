export interface EnterKeyState {
  key: string;
  shiftKey?: boolean;
  isComposing?: boolean;
}

export function shouldSubmitOnEnter(event: EnterKeyState, multiline = true) {
  return event.key === 'Enter'
    && !event.isComposing
    && (!multiline || !event.shiftKey);
}
