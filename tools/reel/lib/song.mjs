// Finds a song's tempo and a strong stretch to use, so a film's cuts can land on the beat.
export const SAMPLE_RATE = 22050;
const WIN = 1024;
const HOP = 512;

// In-place radix-2 FFT.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}

// Rises in the spectrum, frame by frame, plus each frame's loudness.
function onsets(samples) {
  const frames = Math.max(0, Math.floor((samples.length - WIN) / HOP));
  const flux = new Float64Array(frames);
  const energy = new Float64Array(frames);
  const hann = Float64Array.from({ length: WIN }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN));
  let prev = new Float64Array(WIN / 2);
  const re = new Float64Array(WIN), im = new Float64Array(WIN);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < WIN; i++) {
      const v = samples[f * HOP + i];
      re[i] = v * hann[i]; im[i] = 0;
      energy[f] += v * v;
    }
    fft(re, im);
    const mag = new Float64Array(WIN / 2);
    for (let i = 0; i < WIN / 2; i++) {
      mag[i] = Math.log1p(Math.hypot(re[i], im[i]));
      if (f) flux[f] += Math.max(0, mag[i] - prev[i]);
    }
    prev = mag;
  }
  return { flux, energy };
}

/**
 * @param samples     mono audio at SAMPLE_RATE
 * @param seconds     how long the film runs
 * @param targetBpm   the tempo the film was choreographed at; a song is read at the multiple of its
 *                    beat closest to this, so the film is never sped up or slowed down by more than 25%
 * @returns {{bpm: number, firstBeat: number}}
 */
export function findBeat(samples, seconds, targetBpm) {
  const { flux, energy } = onsets(samples);
  const frames = flux.length;
  if (frames < 2) throw new Error('The song is too short to analyse.');
  if (!flux.some((v) => v > 1e-3)) throw new Error('The song is silent or has no beat to follow. Pass --bpm and --song-start to use it anyway.');
  const rate = SAMPLE_RATE / HOP;

  // The earliest stretch that is close to the song's loudest.
  const span = Math.min(frames, Math.round(seconds * rate));
  const running = [];
  let sum = 0;
  for (let i = 0; i < frames; i++) {
    sum += energy[i];
    if (i >= span) sum -= energy[i - span];
    if (i >= span - 1) running.push(sum);
  }
  const loudest = running.reduce((a, b) => Math.max(a, b), 0);
  const start = Math.max(0, running.findIndex((v) => v >= loudest * 0.6));

  // Tempo comes from the part the film will actually play: songs drift, and intros often differ.
  const end = Math.min(frames, start + span);
  let period = (rate * 60) / targetBpm, best = -Infinity;
  const slowest = (rate * 60) / (targetBpm * 0.75), fastest = (rate * 60) / (targetBpm * 1.25);
  for (let p = fastest; p <= slowest; p += 0.02) {
    // Comparing across several beats pins the tempo down far finer than one frame.
    let score = 0;
    for (let k = 1; k <= 8; k++) {
      const lag = Math.round(p * k);
      for (let i = start + lag; i < end; i++) score += flux[i] * flux[i - lag];
    }
    score *= Math.exp(-0.5 * (Math.log2(p * targetBpm / (rate * 60)) / 0.25) ** 2);
    if (score > best) { best = score; period = p; }
  }

  // Fit tempo and beat position together against every beat in the stretch: a tempo that is even
  // slightly off drifts away from the music over that length, so this settles the exact value.
  let fitted = period, phase = 0, fitScore = -1;
  for (let p = period * 0.97; p <= period * 1.03; p += 0.01) {
    for (let ph = 0; ph < p; ph += 0.25) {
      let score = 0;
      for (let b = start + ph; b < end; b += p) score += flux[Math.round(b)] ?? 0;
      if (score > fitScore) { fitScore = score; fitted = p; phase = ph; }
    }
  }
  return { bpm: (rate * 60) / fitted, firstBeat: (start + phase) / rate };
}
