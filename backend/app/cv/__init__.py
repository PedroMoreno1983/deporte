"""
Computer-vision pipeline for football match analysis.

Components (mirror of https://github.com/abdullahtarek/football_analysis):
  - detector.py        YOLO detection of players / ball / referees / goalkeepers
  - tracker.py         ByteTrack across frames (via `supervision`)
  - team_assigner.py   K-means on jersey-crop pixels → team A / team B
  - view_transformer.py  Pitch perspective warp → 2D minimap (m)
  - speed_distance.py  Per-track velocity (km/h) and distance (m)
  - pipeline.py        Orchestrates everything frame-by-frame
  - runner.py          Background runner that updates VideoAnalysis row + WS

All heavy CV deps (ultralytics, opencv, supervision) are imported lazily so
the rest of the app still boots when they're not installed.
"""
from .pipeline import run_pipeline, PipelineProgress  # re-export
