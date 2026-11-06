"use client";

import { useEffect } from "react";

/** Petit bip sonore à l'affichage (ex. donateurs sans e-mail à envoyer par courrier). */
export function Bip() {
  useEffect(() => {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.35);
    } catch {}
  }, []);
  return null;
}
