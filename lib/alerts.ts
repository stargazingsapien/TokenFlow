"use client";

/**
 * Audio chime and browser notification utilities for TokenFlow OPD calling
 */

export function playHospitalChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // High quality 3-note pleasant hospital public address chime (D5 -> F#5 -> A5)
    const notes = [587.33, 739.99, 880.0];
    const noteStartTimes = [0.0, 0.2, 0.4];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      const startTime = ctx.currentTime + noteStartTimes[i];
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.24, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  } catch (err) {
    console.warn("Audio chime playback error:", err);
  }
}

export function speakCallAnnouncement(
  tokenNumber: number,
  patientName: string,
  lang: "en" | "gu" | "hi" = "en"
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();

    let text = `Token number ${tokenNumber}, ${patientName}, please proceed to the doctor's room.`;
    let voiceLang = "en-IN";

    if (lang === "gu") {
      text = `ટોકન નંબર ${tokenNumber}, ${patientName}, કૃપા કરીને ડોક્ટર રૂમમાં પધારો.`;
      voiceLang = "gu-IN";
    } else if (lang === "hi") {
      text = `टोकन नंबर ${tokenNumber}, ${patientName}, कृपया डॉक्टर के कमरे में आएं.`;
      voiceLang = "hi-IN";
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Fallback if specific language voice not found
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech announcement error:", err);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    try {
      const res = await Notification.requestPermission();
      return res === "granted";
    } catch {
      return false;
    }
  }
  return false;
}

export function showSystemNotification(
  tokenNumber: number,
  patientName: string,
  clinicName: string
) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(`🔔 Now Calling: Token #${tokenNumber}`, {
        body: `${patientName} - Please proceed to Doctor's Cabin (${clinicName})`,
        silent: true
      });
    } catch (err) {
      console.warn("System notification error:", err);
    }
  }
}
