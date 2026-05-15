import tensorflow as tf
import tensorflow_hub as hub
import numpy as np
import os

class SoundClassifier:
    def __init__(self):
        # Load YAMNet model from TF Hub
        # In a real production app, you might download this locally first
        print("Loading YAMNet model...")
        self.model = hub.load('https://tfhub.dev/google/yamnet/1')
        self.class_map_path = self.model.class_map_path().numpy()
        self.class_names = self._load_class_names(self.class_map_path)
        print("Model loaded successfully.")

    def _load_class_names(self, class_map_path):
        import csv
        class_names = []
        with tf.io.gfile.GFile(class_map_path) as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                class_names.append(row['display_name'])
        return class_names

    def classify(self, audio_np):
        """
        Classifies audio and returns the most specific top prediction.
        audio_np: 1-D float32 numpy array of 16kHz audio.
        """
        scores, embeddings, spectrogram = self.model(audio_np)

        # Average scores over all frames
        mean_scores = np.mean(scores, axis=0)
        top5_indices = np.argsort(mean_scores)[-5:][::-1]

        # Generic labels that obscure specific sounds — skip them
        GENERIC = {
            'Silence', 'Background noise', 'Noise', 'Sound', 'Environmental noise',
            'Inside, small room', 'Inside, large room or hall',
            'Outside, urban or manmade', 'Outside, rural or natural',
            'Music', 'Speech', 'Narration, monologue',
        }

        # Find the first (highest-scored) non-generic label
        best_idx = top5_indices[0]
        for idx in top5_indices:
            name = self.class_names[idx]
            if name not in GENERIC:
                best_idx = idx
                break

        label = self.class_names[best_idx]
        confidence = float(mean_scores[best_idx])

        return {
            "label": label,
            "confidence": confidence,
            "all_predictions": [
                {"label": self.class_names[i], "confidence": float(mean_scores[i])}
                for i in top5_indices
            ]
        }

# Singleton instance
classifier = None

def get_classifier():
    global classifier
    if classifier is None:
        classifier = SoundClassifier()
    return classifier
