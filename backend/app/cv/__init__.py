"""
Computer-vision pipeline for football match analysis.

Components (mirror of https://github.com/abdullahtarek/football_analysis):
  - labels.py          Semantic class schema (player/keeper/referee/ball ↔ ids)
  - model_loader.py    Checkpoint resolution (explicit→env→fine-tuned→base)
  - train.py           Fine-tune YOLO on a YOLO-format dataset + publish sidecar
  - detector.py        YOLO detection of players / ball / referees / goalkeepers
  - jersey_ocr.py      Jersey-number OCR (EasyOCR) + cross-frame voting
  - reid.py            Appearance ReID — merge fragmented tracks per player
  - events.py          High-intensity events: sprints / accel / decel / COD
  - tracker.py         ByteTrack across frames (via `supervision`)
  - team_assigner.py   K-means on jersey-crop pixels → team A / team B
  - view_transformer.py  Pitch perspective warp → 2D minimap (m)
  - speed_distance.py  Per-track velocity (km/h) and distance (m)
  - annotate.py        Annotated output.mp4 (boxes, labels, pitch minimap)
  - pipeline.py        Orchestrates everything frame-by-frame
  - runner.py          Background runner that updates VideoAnalysis row + WS

All heavy CV deps (ultralytics, opencv, supervision) are imported lazily so
the rest of the app still boots when they're not installed.
"""
from .labels import ClassSchema, FOOTBALL_CLASSES  # re-export (pure-python, always importable)
from .model_loader import ResolvedWeights, cv_model_dir, resolve_weights
from .jersey_ocr import JerseyReader, JerseyVoter, plausible_jersey_number, torso_crop
from .reid import ColorHistogramEmbedder, ReIDGallery, cosine_similarity, l2_normalize
from .events import EventDetector, Event
from .annotate import MatchAnnotator, VideoSink, box_caption, pitch_to_minimap, team_color_bgr
from .pipeline import run_pipeline, PipelineProgress
