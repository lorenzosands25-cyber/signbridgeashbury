# Full ASL phrases and movements
- [ ] Add broader phrase and movement recognition; blocked on a verified trained ASL sequence model and signing-video validation data, not additional handshape rules.

# Inline gesture transitions
- [x] Show tentative text inline with final translation using muted text and a dotted underline; only accepted text enters speech, copy, and saved history.
- [x] Accept the prior guess above 65% on a different detected sign from the same hand in free conversation; guided practice retains its gate. Reset on lost/low-confidence evidence, camera changes, and sample gaps. All 58 ASL tests pass; browser verified early L acceptance on D transition, inline next guess, no unaccepted text after camera stop, and 771px layout. Gesture changes are acceptance heuristics, not proof of accuracy.

# Moving gesture matching
- [x] Improve continuous moving-gesture matching: chest-height Yes uses body-relative cumulative reversals, supports 10–120 fps samples, rejects jitter/body shifts, and retains Sorry precedence. Motion requires 600ms and six samples rather than twelve; no confirmation thresholds lowered. 54 ASL tests pass; simulated moving-camera flow shows tentative Yes before gated text, then clears stale suggestions when motion stops. Physical-signing accuracy remains unverified.
- [x] User chose tentative suggestions strictly above 65%, separate from Live Translation and speech. Handshape confidence caps movement confidence; 70% for over two seconds still gates every translation, and experimental two-hand practice keeps its original confidence floor.

# Camera and quality upgrade
- [x] Add camera device selection, quality/mirror/overlay controls, generation-safe cancellation, disconnected/busy camera recovery, and GPU-to-CPU fallback. Browser verified camera startup, quality restart, mirror, stop, and delayed-request cancellation.
- [x] Bound inference frame dimensions while retaining aspect ratio and every distinct frame, stabilize hand ordering, reuse brightness canvas, and show measured fps/inference time. Headless fake-camera test measured 1 fps / 987 ms; no 10x speedup or real-signing accuracy improvement established. Continuous 70%/over-two-second gate retained and browser verified.
- [x] Expand from four to ten supported-sign practice sequences and refine the conversation layout; replies and 390px/771px/1280px layouts verified. All 43 selected tests pass. Full ASL recognition remains blocked above.

# Competition improvements
- [x] Add experimental, guided-practice-only Help, Nice / Clean, and Meet rules with two-hand safeguards; synthetic tests pass, physical signing accuracy is unverified.
- [x] Add four multi-sign practice sequences that advance only on confirmed signs, without guessing English sentences.
- [x] Polish the conversation screen, add quick replies and confirmation progress; camera startup, phrase selection, replies, and desktop/mobile layout verified; 33 tests pass.

# Recognition accuracy
- [x] Parallelize model loading, deduplicate/rate-limit display-only updates, eliminate repeated canvas resizing, and reset evidence between phrase steps. Fake-camera benchmark reduced canvas resets from 8 to 0 over three seconds but processed frames remained 4; no 10x speedup established. Recognition thresholds and per-frame inference retained.
- [x] Reset old single/two-hand motion evidence on the first changed-handshape frame, retaining the 600ms motion evidence and 70%/over-two-second confirmation thresholds; 33 recognition tests and camera/layout checks pass. Physical signing accuracy remains unverified.
- [x] Retain continuous 70% confidence for over two seconds in guided practice and for unchanged signs; free conversation now also permits user-requested gesture-transition acceptance.
- [x] Reduce false matches and prevent mixing hand tracks or stale frames.
- [x] Test confirmation rules and verify the camera flow (simulated landmarks confirmed delayed text and no duplicates; physical signing accuracy remains unverified).

# Conversation audio and replies
- [x] Add ElevenLabs speech and committed-text playback with mute/replay.
- [x] Add a Response text box below Live Translation.
- [x] Verify speech behavior, replies, and mobile layout (sample committed text played through ElevenLabs; physical signing not tested).