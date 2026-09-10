# Spatial Audio Lab — Three.js / Spatial X

Serve the repository root with `python -m http.server 8766` and open
`http://localhost:8766/playground/spatial-audio/`.

- Three.js 0.180.0 + Spark 2.1.0, vendored locally with licenses. Actual
  `splat_2949001.sog` stadium (1,690,469 splats) and `ballO6.fbx` with its
  photographic color texture are included from the supplied Unity project.
- Stadium scale/height/yaw defaults reference `GB_CourtFloor.prefab`; this is
  a visual registration, not a calibrated physical measurement of the court.
- Drag to look around, arrows to turn, fullscreen for first-person immersion.
  On a WebXR-capable headset, VR entry is offered; controller trigger records
  the direction of gaze. Headset hardware has not been tested.
- The ball is shown only while exploring; it is hidden throughout the test.
- Headphones required. Web Audio HRTF, fixed source distance, synthesized mono bell.
- 0° front, clockwise positive; right arrow rotates listener clockwise.
- 12 balanced azimuths, shuffled across 12/24/36 trials. No answer cue before response.
- Arrows: 5° per tap, 75°/s while held. Space: record. Escape: finish partial session.
- Response time uses AudioContext time from scheduled sound onset; includes rotation
  and device latency. It is not calibrated acoustic reaction time.
- Timeout after 30 seconds; no angle/RT imputation, timeout counts as a miss.
- Circular absolute error in [0, 180], hit threshold inclusive at 15°.
- CSV contains per-trial observations. No data is sent or persisted automatically.
- ASCII and little/big-endian binary PLY supported (scalar vertex properties,
  vertices first, x/y/z coordinates, 100 MB maximum). Display samples up to 18,000
  points and normalizes bounds. Y-up/Z-up selectable. PLY is visual context only;
  this prototype does not estimate room acoustics, reflection or reverberation.
- This is an exploratory demo, not a validated hearing assessment.

The arena scan is visual context; acoustic reflections/reverberation are not
modeled. The supplied FBX is used with its baked color texture for consistent
appearance inside the splat renderer. The sound remains synthetic.

Checks: `node tests/spatial-audio.cjs` (run at repository root). Browser checks
cover SOG/FBX loading, keyboard heading changes, full 12-trial completion,
dark-mode input, and fullscreen.
