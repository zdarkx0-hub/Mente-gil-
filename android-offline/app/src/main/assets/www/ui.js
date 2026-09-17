"use strict";
// Explicit dependencies keep this feature independent of application startup.
window.MenteModules = window.MenteModules || {};
window.MenteModules.ui = function ({ store }) {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let toastTimer = null;
  let audioContext = null;

  function applyTheme(theme) {
    // Keep the viewport background and every component on the same palette.
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setSingleActive(containerSelector, button) {
    $$(containerSelector + " button").forEach((item) =>
      item.classList.toggle("active", item === button),
    );
  }

  function playSound(correct) {
    if (!store.getData().profile.sound) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext = audioContext || new AudioContextClass();
      const now = audioContext.currentTime;
      const notes = correct
        ? [
            { frequency: 659, delay: 0, duration: 0.11 },
            { frequency: 784, delay: 0.07, duration: 0.16 },
          ]
        : [{ frequency: 230, delay: 0, duration: 0.2 }];
      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = now + note.delay;
        const end = start + note.duration;
        oscillator.type = correct ? "sine" : "triangle";
        oscillator.frequency.setValueAtTime(note.frequency, start);
        if (!correct)
          oscillator.frequency.exponentialRampToValueAtTime(165, end);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
          correct ? 0.1 : 0.07,
          start + 0.012,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(end);
      });
    } catch (_) {
      // Alguns aparelhos podem bloquear áudio até a primeira interação.
    }
  }

  return { $, $$, applyTheme, showToast, setSingleActive, playSound };
};
