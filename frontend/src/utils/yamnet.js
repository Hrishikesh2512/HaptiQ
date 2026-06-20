import * as tf from '@tensorflow/tfjs';
import { YAMNET_LABELS } from './yamnetLabels';

// YAMNet as a TF.js graph model. Served from our own origin first (no external
// runtime dependency, no CORS, works offline). The remote handles are only a
// last-ditch fallback — TFHub now redirects to Kaggle and no longer serves the
// model directly, so the bundled copy is what actually loads.
const MODEL_URLS = [
  { url: `${import.meta.env.BASE_URL}model/model.json`, fromTFHub: false },
  { url: 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs-graph-model/1', fromTFHub: true },
];

// Generic labels to skip — return the more specific sound instead
const GENERIC = new Set([
  'Silence', 'Background noise', 'Noise', 'Sound', 'Environmental noise',
  'Inside, small room', 'Inside, large room or hall',
  'Outside, urban or manmade', 'Outside, rural or natural',
  'Music', 'Speech', 'Narration, monologue',
]);

export class YamnetClassifier {
  constructor() {
    this.model = null;
    // Labels are bundled (no runtime network dependency) so a detection can
    // never come back as a meaningless "Sound 137".
    this.labels = YAMNET_LABELS;
  }

  async load(onProgress) {
    await tf.ready();
    onProgress?.('Loading AI model…');

    let lastErr;
    for (const { url, fromTFHub } of MODEL_URLS) {
      try {
        this.model = await tf.loadGraphModel(url, { fromTFHub });
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`[YAMNet] Failed to load ${url}:`, e.message);
      }
    }
    if (!this.model) {
      throw new Error(`Could not load the sound model. ${lastErr?.message || ''}`.trim());
    }

    onProgress?.('AI ready');
  }

  predict(audioBuffer) {
    if (!this.model) return null;
    return tf.tidy(() => {
      // YAMNet expects a 1-D waveform tensor (shape [num_samples]).
      const input = tf.tensor1d(audioBuffer);
      const out = this.model.predict(input);
      // The model returns 3 tensors (spectrogram, embeddings, scores) and the
      // order is not guaranteed — pick the class-scores one by its 521 dim.
      const outputs = Array.isArray(out) ? out : [out];
      const scores = outputs.find(t => t.shape[t.shape.length - 1] === 521);
      const meanScores = scores.mean(0);
      const scoresData = meanScores.dataSync();

      // Get top 5
      const top5 = Array.from(scoresData)
        .map((score, index) => ({ score, index }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Pick highest-confidence specific label
      const best = top5.find(({ index }) => !GENERIC.has(this.labels[index] || '')) || top5[0];
      return {
        label: this.labels[best.index] || 'Sound',
        confidence: best.score,
        top5: top5.map(({ index, score }) => ({ label: this.labels[index], score })),
      };
    });
  }
}
