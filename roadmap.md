# Full ASL phrases and movements
- [ ] Add broader phrase and movement recognition; blocked on a verified trained ASL sequence model and signing-video validation data, not additional handshape rules.

# Competition improvements
- [x] Add experimental, guided-practice-only Help, Nice / Clean, and Meet rules with two-hand safeguards; synthetic tests pass, physical signing accuracy is unverified.
- [x] Add four multi-sign practice sequences that advance only on confirmed signs, without guessing English sentences.
- [x] Polish the conversation screen, add quick replies and confirmation progress; camera startup, phrase selection, replies, and desktop/mobile layout verified; 33 tests pass.

# Recognition accuracy
- [ ] Reset old motion evidence immediately on handshape changes while preserving all confirmation thresholds; verify switching and camera behavior.
- [x] Require continuous 70% confidence for more than two seconds for every committed sign.
- [x] Reduce false matches and prevent mixing hand tracks or stale frames.
- [x] Test confirmation rules and verify the camera flow (simulated landmarks confirmed delayed text and no duplicates; physical signing accuracy remains unverified).

# Conversation audio and replies
- [x] Add ElevenLabs speech and committed-text playback with mute/replay.
- [x] Add a Response text box below Live Translation.
- [x] Verify speech behavior, replies, and mobile layout (sample committed text played through ElevenLabs; physical signing not tested).