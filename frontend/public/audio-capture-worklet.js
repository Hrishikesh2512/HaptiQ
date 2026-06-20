// AudioWorklet that captures microphone audio off the main thread and
// resamples it to a fixed 16 kHz (what YAMNet expects), regardless of the
// AudioContext's actual sample rate. It posts mono Float32 frames back to the
// main thread. This replaces the deprecated ScriptProcessorNode and removes
// the assumption that the browser honours a 16 kHz context.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options?.processorOptions || {};
    this.targetRate = opts.targetRate || 16000;
    // Input samples consumed per output sample (>= 1 when downsampling).
    this.ratio = sampleRate / this.targetRate;
    this.readPos = 0;   // fractional read position carried across blocks
    this.prevLast = 0;  // last input sample of the previous block (index -1)
    this.out = [];
    this.flushAt = Math.round(this.targetRate / 10); // post ~100 ms at a time
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    const n = ch.length;

    const sampleAt = (i) => (i < 0 ? this.prevLast : ch[i]);

    let p = this.readPos;
    // Linear interpolation; stop before n-1 so i0+1 is always in range.
    while (p < n - 1) {
      const i0 = Math.floor(p);
      const frac = p - i0;
      this.out.push(sampleAt(i0) * (1 - frac) + sampleAt(i0 + 1) * frac);
      p += this.ratio;
    }
    this.readPos = p - n; // re-base for the next block (index 0 -> previous n)
    this.prevLast = ch[n - 1];

    if (this.out.length >= this.flushAt) {
      const frame = new Float32Array(this.out);
      this.out.length = 0;
      this.port.postMessage(frame, [frame.buffer]);
    }
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
