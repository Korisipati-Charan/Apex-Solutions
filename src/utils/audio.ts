/**
 * Off-line Web Audio API synthesizer helper.
 * Generates clear beep sounds for the candidate break countdown timer.
 */

let audioCtx: AudioContext | null = null;

export function playBeep(frequency = 880, durationMs = 150, type: OscillatorType = "sine") {
  try {
    // Lazy initialize to bypass browser auto-play policies until user interaction
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    // Smooth volume fade out to prevent speaker clicking
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (durationMs / 1000));
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + (durationMs / 1000));
  } catch (err) {
    console.warn("Audio Context beep error (possibly blocked by browser permissions):", err);
  }
}
