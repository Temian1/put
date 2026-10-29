export function createAudio(Save) {
  const Sound = {
    ctx: null,
    step: 0,
    nextT: 0,
    init() {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
      } catch (e) {
        return;
      }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(c.destination);
      this.sfx = c.createGain();
      this.sfx.gain.value = 0.85;
      this.sfx.connect(this.master);
      this.mus = c.createGain();
      this.mus.gain.value = Save.d.music ? 0.2 : 0;
      this.mus.connect(this.master);
      const len = Math.floor(c.sampleRate * 0.5);
      this.nbuf = c.createBuffer(1, len, c.sampleRate);
      const ch = this.nbuf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      this.nextT = c.currentTime + 0.1;
    },
    tone(f, d, type, v, f2, at, dest) {
      const c = this.ctx;
      if (!c) return;
      at = at || c.currentTime;
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(f, at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + d);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(v || 0.2, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g);
      g.connect(dest || this.sfx);
      o.start(at);
      o.stop(at + d + 0.05);
    },
    noise(d, v, freq, at, dest, ftype) {
      const c = this.ctx;
      if (!c) return;
      at = at || c.currentTime;
      const s = c.createBufferSource();
      s.buffer = this.nbuf;
      const f = c.createBiquadFilter();
      f.type = ftype || "highpass";
      f.frequency.value = freq || 3000;
      const g = c.createGain();
      g.gain.setValueAtTime(v, at);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      s.connect(f);
      f.connect(g);
      g.connect(dest || this.sfx);
      s.start(at);
      s.stop(at + d + 0.02);
    },
    seq(notes, gap, type, v, d) {
      const t = this.ctx.currentTime;
      notes.forEach((f, i) =>
        this.tone(f, d || 0.15, type, v, null, t + i * gap),
      );
    },
    play(n) {
      if (!this.ctx || !Save.d.sound) return;
      switch (n) {
        case "tap":
          this.tone(480, 0.1, "sine", 0.25, 900);
          this.noise(0.05, 0.06, 5000);
          break;
        case "place":
          this.tone(760, 0.08, "triangle", 0.18, 1100);
          break;
        case "serve":
          this.seq([660, 880, 1320], 0.07, "triangle", 0.18, 0.16);
          break;
        case "coin":
          this.seq([1320, 1760], 0.06, "square", 0.05, 0.12);
          break;
        case "wrong":
          this.tone(230, 0.25, "sawtooth", 0.12, 140);
          break;
        case "lose":
          this.seq([392, 262], 0.18, "triangle", 0.18, 0.3);
          break;
        case "arrive":
          this.seq([988, 1319], 0.08, "sine", 0.1, 0.18);
          break;
        case "combo":
          this.seq([784, 988, 1175, 1568], 0.05, "square", 0.06, 0.12);
          break;
        case "win":
          this.seq(
            [523, 659, 784, 1047, 784, 1047],
            0.12,
            "triangle",
            0.2,
            0.24,
          );
          break;
        case "fail":
          this.seq([392, 349, 311, 262], 0.16, "triangle", 0.18, 0.3);
          break;
        case "star":
          this.tone(1047, 0.3, "sine", 0.2, 2093);
          break;
        case "buy":
          this.seq([523, 784, 1047], 0.06, "square", 0.08, 0.14);
          break;
        case "click":
          this.tone(620, 0.06, "sine", 0.14, 480);
          break;
        case "go":
          this.tone(523, 0.15, "square", 0.1);
          this.tone(
            784,
            0.32,
            "square",
            0.1,
            null,
            this.ctx.currentTime + 0.15,
          );
          break;
        case "tick":
          this.tone(1400, 0.04, "square", 0.05);
          break;
        case "siren": {
          const t = this.ctx.currentTime;
          this.tone(960, 0.28, "square", 0.04, 720, t);
          this.tone(720, 0.28, "square", 0.04, 960, t + 0.3);
          break;
        }
        case "whoosh":
          this.noise(0.35, 0.12, 900, null, null, "bandpass");
          this.tone(220, 0.3, "sawtooth", 0.04, 520);
          break;
        case "zap":
          this.tone(1800, 0.12, "sawtooth", 0.06, 300);
          this.noise(0.12, 0.1, 4000);
          break;
        case "thunder": {
          // A sharp crack, then a long low rumble.
          const t = this.ctx.currentTime;
          this.noise(0.18, 0.35, 2500, t);
          this.noise(1.3, 0.3, 180, t + 0.06, null, "lowpass");
          this.tone(70, 1, "sawtooth", 0.08, 40, t + 0.05);
          break;
        }
        case "boom": {
          const t = this.ctx.currentTime;
          this.tone(140, 0.6, "sine", 0.4, 38, t);
          this.noise(0.7, 0.4, 420, t, null, "lowpass");
          this.noise(0.12, 0.2, 3000, t);
          break;
        }
      }
    },
    setMusic(on) {
      if (this.mus)
        this.mus.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.25);
    },
    tick() {
      const c = this.ctx;
      if (!c) return;
      if (!Save.d.music || c.state !== "running" || document.hidden) {
        this.nextT = c.currentTime + 0.05;
        return;
      }
      const spb = 60 / 108 / 4;
      if (this.nextT < c.currentTime - 0.2) this.nextT = c.currentTime + 0.05;
      while (this.nextT < c.currentTime + 0.15) {
        this.beat(this.step, this.nextT);
        this.nextT += spb;
        this.step++;
      }
    },
    MEL: [
      [0, null, 7, null, 9, null, 7, 12, null, 9, 7, null, 4, null, 2, null],
      [
        9,
        null,
        null,
        7,
        9,
        null,
        12,
        null,
        9,
        null,
        7,
        null,
        4,
        null,
        null,
        null,
      ],
      [5, null, 9, null, 12, null, 9, null, 7, null, 5, null, 4, null, 2, null],
      [7, null, null, 4, 7, null, 9, null, 7, null, 4, null, 2, null, 4, null],
    ],
    beat(s, t) {
      const st = s % 16,
        bar = Math.floor(s / 16) % 4,
        m = this.mus,
        mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
      const roots = [48, 45, 41, 43];
      if ([0, 6, 8, 14].includes(st))
        this.tone(120, 0.18, "sine", 0.55, 45, t, m);
      this.noise(0.03, st % 2 ? 0.04 : 0.08, 7000, t, m);
      if (st === 4 || st === 12) this.noise(0.12, 0.16, 1800, t, m, "bandpass");
      if ([0, 3, 8, 11].includes(st))
        this.tone(
          mtof(roots[bar] - 12 + (st === 8 ? 7 : 0)),
          0.22,
          "triangle",
          0.28,
          null,
          t,
          m,
        );
      const mel = this.MEL[bar][st];
      if (mel !== null) {
        this.tone(mtof(72 + mel), 0.28, "sine", 0.12, null, t, m);
        this.tone(mtof(84 + mel), 0.1, "sine", 0.04, null, t, m);
      }
    },
  };

  return Sound;
}
