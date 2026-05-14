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
        Classifies audio and returns top predictions.
        audio_np: 1-D float32 numpy array of 16kHz audio.
        """
        scores, embeddings, spectrogram = self.model(audio_np)
        
        # Average scores over all frames
        mean_scores = np.mean(scores, axis=0)
        top_class_index = np.argmax(mean_scores)
        
        prediction = self.class_names[top_class_index]
        confidence = float(mean_scores[top_class_index])
        
        return {
            "label": prediction,
            "confidence": confidence,
            "all_predictions": [
                {"label": self.class_names[i], "confidence": float(mean_scores[i])}
                for i in np.argsort(mean_scores)[-5:][::-1]
            ]
        }

# Singleton instance
classifier = None

def get_classifier():
    global classifier
    if classifier is None:
        classifier = SoundClassifier()
    return classifier
