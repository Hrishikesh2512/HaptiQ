"""Critical-sound matching, kept free of heavy ML imports so it is cheap to
import and easy to unit-test."""

# All sounds we want to surface as alerts.
CRITICAL_SOUNDS = {
    # Emergency
    "siren", "civil defense siren", "police car (siren)", "ambulance (siren)",
    "fire engine, fire truck (siren)", "emergency vehicle",
    # Alerts / alarms
    "alarm", "fire alarm", "smoke detector", "carbon monoxide detector",
    "alarm clock", "buzzer", "bell",
    # Door
    "doorbell", "door",
    # People
    "crying, sobbing", "baby cry, infant cry", "screaming", "shout",
    "yell", "crowd", "cheering",
    # Animals
    "dog", "dog bark", "bark", "howl",
    # Accidents
    "glass breaking", "breaking", "crash", "bang", "gunshot",
    # Vehicles
    "horn", "car horn, honking", "vehicle horn",
}


def is_critical(label: str) -> bool:
    label_lower = label.lower()
    return any(keyword in label_lower for keyword in CRITICAL_SOUNDS)
