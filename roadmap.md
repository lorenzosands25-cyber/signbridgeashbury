# Full ASL phrases and movements
- [ ] Add broader phrase and movement recognition; blocked on a verified trained ASL sequence model and signing-video validation data, not additional handshape rules.

# Competition improvements
- [ ] Add bounded two-hand signs with safeguards and automated checks.
- [ ] Add multi-sign phrase practice without guessing English sentences.
- [ ] Polish the live conversation screen and verify desktop/mobile flows.

# Recognition accuracy
- [x] Require continuous 70% confidence for more than two seconds for every committed sign.
- [x] Reduce false matches and prevent mixing hand tracks or stale frames.
- [x] Test confirmation rules and verify the camera flow (simulated landmarks confirmed delayed text and no duplicates; physical signing accuracy remains unverified).

# Conversation audio and replies
- [x] Add ElevenLabs speech and committed-text playback with mute/replay.
- [x] Add a Response text box below Live Translation.
- [x] Verify speech behavior, replies, and mobile layout (sample committed text played through ElevenLabs; physical signing not tested).