export interface SearchInputController {
  beforeInput(event: Pick<InputEvent, "inputType" | "isComposing">): void;
  compositionStart(): void;
  compositionUpdate(): void;
  compositionEnd(): void;
  input(event: Pick<InputEvent, "isComposing">): void;
  reset(): void;
}

export function createSearchInputController(
  readValue: () => string,
  schedule: (value: string) => void,
  cancel: () => void = () => undefined,
  afterValueCommit: (callback: () => void) => void = callback => setTimeout(callback, 0),
): SearchInputController {
  let composing = false;
  const hasIncompleteKorean = (value: string) => /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/u.test(value);
  const sync = () => {
    const value = readValue();
    if (hasIncompleteKorean(value)) cancel();
    else schedule(value);
  };
  return {
    beforeInput(event) {
      if (composing || event.isComposing || event.inputType === "insertCompositionText") cancel();
    },
    compositionStart() { composing = true; cancel(); },
    compositionUpdate() { composing = true; cancel(); },
    compositionEnd() {
      composing = false;
      afterValueCommit(sync);
    },
    input(event) {
      if (composing || event.isComposing) {
        cancel();
        // Windows Korean IME can keep composing after the visible syllable is
        // complete. Read once more after this event so WebView's latest DOM
        // value enters the debounce without waiting for a navigation key.
        afterValueCommit(sync);
        return;
      }
      sync();
    },
    reset() { composing = false; cancel(); },
  };
}
