# Full ASL phrases and movements
- [ ] Add broader phrase and movement recognition; blocked on a verified trained ASL sequence model and signing-video validation data, not additional handshape rules.

# Competition improvements
- [x] Add experimental, guided-practice-only Help, Nice / Clean, and Meet rules with two-hand safeguards; synthetic tests pass, physical signing accuracy is unverified.
- [x] Add four multi-sign practice sequences that advance only on confirmed signs, without guessing English sentences.
- [x] Polish the conversation screen, add quick replies and confirmation progress; camera startup, phrase selection, replies, and desktop/mobile layout verified; 33 tests pass.

# Recognition accuracy
- [x] Parallelize model loading, deduplicate/rate-limit display-only updates, eliminate repeated canvas resizing, and reset evidence between phrase steps. Fake-camera benchmark reduced canvas resets from 8 to 0 over three seconds but processed frames remained 4; no 10x speedup established. Recognition thresholds and per-frame inference retained.
- [x] Reset old single/two-hand motion evidence on the first changed-handshape frame, retaining the 600ms motion evidence and 70%/over-two-second confirmation thresholds; 33 recognition tests and camera/layout checks pass. Physical signing accuracy remains unverified.
- [x] Require continuous 70% confidence for more than two seconds for every committed sign.
- [x] Reduce false matches and prevent mixing hand tracks or stale frames.
- [x] Test confirmation rules and verify the camera flow (simulated landmarks confirmed delayed text and no duplicates; physical signing accuracy remains unverified).

# Conversation audio and replies
- [x] Add ElevenLabs speech and committed-text playback with mute/replay.
- [x] Add a Response text box below Live Translation.
- [x] Verify speech behavior, replies, and mobile layout (sample committed text played through ElevenLabs; physical signing not tested).