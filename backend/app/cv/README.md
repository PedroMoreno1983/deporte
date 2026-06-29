# Computer Vision module

Football-analysis pipeline inspired by
[abdullahtarek/football_analysis](https://github.com/abdullahtarek/football_analysis)
and the LinkedIn article *"Análisis de fútbol con visión por computadora —
YOLO + K-means"* (E. Zepeda).

## What it does

Given a video of a football match it:

1. **Detects** players, the ball, referees and goalkeepers (YOLOv8 via
   [`ultralytics`](https://github.com/ultralytics/ultralytics)).
2. **Tracks** each detection across frames (ByteTrack from
   [`supervision`](https://github.com/roboflow/supervision)).
3. **Clusters** each player into one of two teams by K-means on the dominant
   jersey colour of the bounding-box crop (`scikit-learn`).
4. **Projects** image-plane coordinates into a normalised pitch view (0..100
   × 0..100) so heatmaps and distances are interpretable.
5. **Computes** per-track total distance, average speed and peak speed in
   km/h using the elapsed video time between samples.
6. **Saves** an annotated sample frame plus the full JSON of tracks and
   positions so the frontend can render minimaps, heatmaps and stats.

Progress events are pushed over the existing WebSocket topic `cv`.

## Architecture

```
backend/app/cv/
├── pipeline.py          # public entry: run_pipeline(video, out, on_progress)
├── detector.py          # YOLO wrapper with lazy import / lazy weights
├── tracker.py           # ByteTrack adapter
├── team_assigner.py     # K-means on jersey crops
├── view_transformer.py  # 4-point homography image → pitch coords
├── speed_distance.py    # per-track aggregation
├── runner.py            # DB update + WS broadcast wrapper
└── README.md            # ← you are here
```

Pipeline is invoked from the `/api/v1/cv/upload` endpoint via FastAPI's
`BackgroundTasks`. The same runner can be hooked into Celery/RQ later — the
function signature `process_video(analysis_id, video_path, output_dir, weights)`
is intentionally simple.

## Setup

Heavy ML deps are pinned in `backend/requirements.txt` but the rest of the
API works without them. To enable the pipeline:

```bash
pip install ultralytics opencv-python-headless supervision Pillow
```

The pipeline auto-downloads `yolov8n.pt` on first use (≈ 6 MB). For better football-specific accuracy, place `players.pt` plus `players.meta.json` under `DEPORTE_CV_MODEL_ROOT` or `<DEPORTE_CV_ROOT>/models`, or pin a checkpoint with `DEPORTE_YOLO_CKPT`. Without that, the pipeline falls back to stock `yolov8n.pt`, which is useful for person detection but not enough for fine football semantics.

Storage:

- Uploaded videos live in `<DEPORTE_CV_ROOT>/uploads/<uuid>.<ext>`.
- Annotated samples, optional `output.mp4`, and `results.json` live in `<DEPORTE_CV_ROOT>/outputs/<uuid>/`.
- Override the root with `DEPORTE_CV_ROOT` and the model folder with `DEPORTE_CV_MODEL_ROOT`.

## API surface

| Method | Path                          | Purpose                                |
|--------|-------------------------------|----------------------------------------|
| GET    | `/api/v1/cv`                  | List analyses for the current club     |
| POST   | `/api/v1/cv/upload`           | Upload a video; returns the new row    |
| GET    | `/api/v1/cv/{id}`             | Status + results (when done)           |
| GET    | `/api/v1/cv/{id}/sample.jpg`  | Annotated sample frame (when done)     |
| DELETE | `/api/v1/cv/{id}`             | Remove an analysis and its files       |

Real-time progress is broadcast on the `cv` WebSocket topic with payload
`{ analysis_id, fraction, stage, club_id }`.

## Output JSON shape

```jsonc
{
  "tracks": [
    {
      "track_id": 4,
      "cls": "player",
      "team": "A",                  // "A" | "B" | null
      "team_color": "#1aff95",
      "appearances": 312,
      "total_distance_m": 854.2,
      "avg_speed_kmh": 7.4,
      "max_speed_kmh": 28.1,
      "positions": [
        { "frame": 0, "x": 54.2, "y": 61.0 },
        { "frame": 1, "x": 54.5, "y": 60.7 }
      ]
    }
  ],
  "team_colors": { "A": "#1aff95", "B": "#0ea5e9" },
  "sample": "sample.jpg"
}
```

## Multi-tenant

`VideoAnalysis.club_id` is set from the JWT on upload. All queries go through
`scoped_query(VideoAnalysis, current_user)` so a coach only sees analyses
from their own club.

## Caveats

- Player → squad identity (mapping a track to a `Player` row) is **not**
  attempted automatically. A future iteration can match by jersey number
  (OCR on the back of the shirt) or by manual assignment from the UI.
- Real ground-truth scaling for distance/speed requires calibrated pitch
  corner points. The default homography uses generic FIFA dimensions
  (105 × 68 m). Override per-video by passing four corner clicks in a
  future endpoint extension.
- Reduce inference cost by using `yolov8n.pt` (~6 MB) at the expense of
  detection recall on tight crowds. Use `yolov8s.pt` or `yolov8m.pt` if a
  GPU is available.

## Hostinger CPU profile

For Hostinger VPS/KVM CPU deployments, keep the worker conservative by default:

```env
DEPORTE_CV_STRIDE=6
DEPORTE_CV_IMGSZ=480
DEPORTE_CV_OCR=0
DEPORTE_CV_VIDEO=0
DEPORTE_CV_TORCH_THREADS=2
```

This improves reliability and keeps the API responsive. It does not replace a
football-trained checkpoint: for better capture quality, install `players.pt`
and its `players.meta.json` sidecar.