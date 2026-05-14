from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from .database import Base

class SoundAlert(Base):
    __tablename__ = "sound_alerts"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "label": self.label,
            "confidence": self.confidence,
            "timestamp": self.timestamp.isoformat()
        }
