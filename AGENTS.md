<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
- ASL recognition: MediaPipe Hand + Pose landmarkers (on-device). Static handshapes in src/lib/asl/classifier.ts, body-location/movement word signs in src/lib/asl/motion.ts; replace either with trained models keeping their output shapes so UI/commit logic stays unchanged. Only SentenceBuilder commits text, gated by confidence, so nothing uncertain is shown as recognized.
- All letter and motion candidates pass through SentenceBuilder's continuous wall-clock gate; reset evidence on low confidence, source changes, camera transitions, or sample gaps to avoid stale confirmations.
- Speech uses a validated server function with the linked ElevenLabs credential; only committed SentenceBuilder text enters the cancelable, serialized client playback queue, keeping secrets and camera frames out of speech requests.
- Experimental two-hand rules are target-restricted to guided practice; paired landmarks must be synchronized, and phrase steps advance only from SentenceBuilder commits to avoid treating unvalidated heuristics as general ASL translation.
- Single and paired motion buffers use the shared shape-aware window helper to discard changed-shape or interrupted evidence immediately, preventing stale movement matches without lowering confirmation thresholds.
- Display updates are deduplicated and rate-limited separately from per-video-frame recognition; parallel model initialization and resize-only canvas allocation reduce overhead without thinning recognition evidence.
- Camera constraints and aspect-preserving inference sizing live in a shared browser-safe helper; camera requests are generation-cancelled and hand tracks sorted by handedness to prevent races and false evidence resets.
- Tentative matches use a display-only confidence filter and never feed speech or practice advancement; motion confidence is capped by observed handshape evidence, and Yes uses body-relative cumulative reversals rather than frame-dependent deltas.
