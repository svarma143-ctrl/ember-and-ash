/**
 * Tiny WebAudio synth kit - no audio assets required.
 */

class AudioKit {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private ensure(): AudioContext {
    if (this.ctx == null) {
      this.ctx = new AudioContext();
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Short woody pop when fuel lands in the fire. */
  pop(intensity = 1): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.16);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5 * intensity, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
    // spark sizzle
    this.hiss(0.09, 0.18 * intensity, 4200);
  }

  /** Band-limited noise burst - resin flare / whoosh. */
  hiss(duration = 0.4, volume = 0.3, freq = 1200): void {
    const ctx = this.ensure();
    if (this.noiseBuffer == null) {
      return;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(freq, t);
    band.Q.setValueAtTime(0.9, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  /** Low gust whoosh. */
  gust(): void {
    const ctx = this.ensure();
    if (this.noiseBuffer == null) {
      return;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.setValueAtTime(1.4, t);
    band.frequency.setValueAtTime(220, t);
    band.frequency.exponentialRampToValueAtTime(640, t + 0.7);
    band.frequency.exponentialRampToValueAtTime(180, t + 1.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.55, t + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    src.connect(band).connect(gain).connect(ctx.destination);
    src.start(t);
    src.stop(t + 1.75);
  }

  /** Reward chime for a blocked gust / dawn. */
  chime(streak = 1): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * Math.min(streak, 3) * 0.999 + f * 0.001;
      const start = t + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.95);
    });
  }

  /** Fire has died - low descending tone. */
  doom(): void {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 1.4);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.55);
  }
}

export const audio = new AudioKit();
