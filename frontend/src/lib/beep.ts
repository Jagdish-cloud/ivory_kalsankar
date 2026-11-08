let audioContext: AudioContext | null = null;

function tone(frequency: number, startOffset: number, durationMs: number, volume = 0.08) {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioContext = audioContext ?? new Ctor();
    if (audioContext.state === "suspended") void audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    const start = audioContext.currentTime + startOffset;
    oscillator.start(start);
    oscillator.stop(start + durationMs / 1000);
  } catch {
    // Audio feedback is best-effort only.
  }
}

/** Short high beep - item scanned and added. */
export function beepSuccess() {
  tone(1040, 0, 90);
}

/** Two low beeps - unknown barcode / out of stock / limit reached. */
export function beepError() {
  tone(240, 0, 160, 0.1);
  tone(190, 0.2, 220, 0.1);
}
