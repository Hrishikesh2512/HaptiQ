import * as tf from '@tensorflow/tfjs';

// TFHub works fine on HTTPS (Vercel). Only blocked on HTTP local dev.
const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs-graph-model/1/default/1/model.json';

// Fallback: a smaller mirror
const FALLBACK_URL = 'https://storage.googleapis.com/tfjs-models/tfjs/yamnet/1/default/1/model.json';

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
    this.labels = [];
  }

  async load(onProgress) {
    await tf.ready();
    onProgress?.('Loading AI model…');

    // Try primary URL first, then fallback
    const urls = [MODEL_URL, FALLBACK_URL];
    let lastErr;
    for (const url of urls) {
      try {
        this.model = await tf.loadGraphModel(url, { fromTFHub: url.includes('tfhub.dev') });
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`[YAMNet] Failed ${url}:`, e.message);
      }
    }
    if (!this.model) throw new Error(lastErr?.message || 'Model load failed');

    onProgress?.('Loading sound labels…');
    this.labels = await this._fetchLabels();
    onProgress?.('AI ready');
  }

  async _fetchLabels() {
    try {
      const r = await fetch(
        'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv'
      );
      const csv = await r.text();
      return csv
        .split('\n')
        .filter(l => l.trim())
        .slice(1)
        .map(l => {
          const parts = l.split(',');
          return parts[2]?.replace(/"/g, '').trim() || 'Sound';
        });
    } catch {
      // Fallback: return 521 generic labels
      return Array.from({ length: 521 }, (_, i) => `Sound ${i}`);
    }
  }

  predict(audioBuffer) {
    if (!this.model) return null;
    return tf.tidy(() => {
      const input = tf.tensor1d(audioBuffer).expandDims(0);
      const [scores] = this.model.predict(input);
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
