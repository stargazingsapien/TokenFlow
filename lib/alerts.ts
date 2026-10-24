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

    const synthesis = window.speechSynthesis;
    const languagePrefix = voiceLang.toLowerCase().split("-")[0];
    const hasVoiceForLanguage = () =>
      synthesis.getVoices().some((voice) => {
        const voiceLanguage = voice.lang.toLowerCase();
        return voiceLanguage === voiceLang.toLowerCase() ||
          voiceLanguage === languagePrefix ||
          voiceLanguage.startsWith(`${languagePrefix}-`);
      });
    const speak = () => {
      const voices = synthesis.getVoices();
      const selectedVoice =
        voices.find((voice) => voice.lang.toLowerCase() === voiceLang.toLowerCase()) ??
        voices.find((voice) => voice.lang.toLowerCase() === languagePrefix) ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith(`${languagePrefix}-`)) ??
        null;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLang;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.voice = selectedVoice;
      utterance.onerror = (event) => {
        console.warn(`Speech announcement failed for ${voiceLang}:`, event.error);
      };
      synthesis.speak(utterance);
    };

    // Some browsers populate their installed voice list only after the first
    // voiceschanged event. Wait briefly so Gujarati/Hindi can select the right voice.
    if (hasVoiceForLanguage() || lang === "en") {
      speak();
      return;
    }

    let hasSpoken = false;
    let fallbackTimer = 0;
    const speakOnce = () => {
      if (hasSpoken) return;
      hasSpoken = true;
      synthesis.removeEventListener("voiceschanged", onVoicesChanged);
      window.clearTimeout(fallbackTimer);
      speak();
    };
    const onVoicesChanged = () => {
      if (hasVoiceForLanguage()) speakOnce();
    };
    synthesis.addEventListener("voiceschanged", onVoicesChanged);
    fallbackTimer = window.setTimeout(speakOnce, 1200);
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
