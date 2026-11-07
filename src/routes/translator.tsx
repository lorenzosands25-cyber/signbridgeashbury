import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Camera, CameraOff, Check, Copy, Loader2, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { classifyHandshape, SUPPORTED_SIGNS, type Classification } from "@/lib/asl/classifier";
import { detectMotionSign, inBodyZone, MOTION_SIGNS, type Body, type Frame, type Shape } from "@/lib/asl/motion";
import { SentenceBuilder, type BuilderStatus } from "@/lib/asl/sentence";
import { useHistory, useSettings } from "@/lib/store";

export const Route = createFileRoute("/translator")({
  validateSearch: (s: Record<string, unknown>): { practice?: string } =>
    typeof s['practice'] === "string" ? { practice: s['practice'] } : {},
  head: () => ({
    meta: [
      { title: "Live ASL Translator — Signa" },
      { name: "description", content: "Point your camera at ASL handshapes and read them as text in real time." },
      { property: "og:title", content: "Live ASL Translator — Signa" },
      { property: "og:description", content: "Real-time, on-device ASL handshape recognition." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Translator,
});

type CamState = "off" | "requesting" | "loading-model" | "on" | "denied" | "unavailable" | "error";
const CONNECTIONS: [number, number][] = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

const statusInfo: Record<BuilderStatus, { label: string; cls: string }> = {
  idle: { label: "No hand detected", cls: "bg-muted text-muted-foreground" },
  tracking: { label: "Reading sign…", cls: "bg-secondary/20 text-foreground" },
  recognized: { label: "Recognized", cls: "bg-success/15 text-success" },
  "low-confidence": { label: "Low confidence — not added", cls: "bg-warning/20 text-foreground" },
  unrecognized: { label: "Sign not recognized", cls: "bg-destructive/10 text-destructive" },
};

function Translator() {
  const { practice } = Route.useSearch();
  const [settings, setSettings] = useSettings();
  const [, setHistory] = useHistory();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const poseRef = useRef<any>(null);
  const tracksRef = useRef(new Map<string, Frame[]>());
  const [bodyVisible, setBodyVisible] = useState(false);
  const [lastWord, setLastWord] = useState<string | null>(null);
  const rafRef = useRef<number>(0);
  const builder = useRef(new SentenceBuilder());
  const [cam, setCam] = useState<CamState>("off");
  const [errMsg, setErrMsg] = useState("");
  const [status, setStatus] = useState<BuilderStatus>("idle");
  const [current, setCurrent] = useState<Classification | null>(null);
  const [handsView, setHandsView] = useState<{ side: string; cls: Classification }[]>([]);
  const smoothRef = useRef<{ x: number; y: number; z?: number }[][]>([]);
  const [text, setText] = useState("");
  const [lowLight, setLowLight] = useState(false);

  builder.current.threshold = settings.threshold;
  const mirrored = settings.mirror && settings.facingMode === "user";

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam("off");
    setStatus("idle");
    setCurrent(null);
    setHandsView([]);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const loop = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current, lmk = landmarkerRef.current;
    if (!v || !c || !lmk || !streamRef.current) return;
    if (v.readyState >= 2) {
      const now = performance.now();
      const res = lmk.detectForVideo(v, now);
      c.width = v.videoWidth; c.height = v.videoHeight;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      type P = { x: number; y: number; z?: number };
      const raw = (res.landmarks ?? []) as P[][];
      // Light temporal smoothing per hand to reduce jitter between frames.
      const hands = raw.map((h, i) => {
        const prev = smoothRef.current[i];
        const sm = prev && prev.length === h.length
          ? h.map((p, j) => ({ x: p.x * 0.6 + prev[j]!.x * 0.4, y: p.y * 0.6 + prev[j]!.y * 0.4, z: (p.z ?? 0) * 0.6 + (prev[j]!.z ?? 0) * 0.4 }))
          : h;
        return sm;
      });
      smoothRef.current = hands;
      // Body reference from pose: shoulders, mouth and forehead in pixel space.
      const W = c.width, H = c.height;
      const px = (p: { x: number; y: number }) => ({ x: p.x * W, y: p.y * H });
      let body: Body | null = null;
      const pose = poseRef.current?.detectForVideo(v, now)?.landmarks?.[0] as { x: number; y: number }[] | undefined;
      if (pose && pose[11] && pose[12] && pose[9] && pose[10] && pose[2] && pose[5]) {
        const ls = px(pose[11]), rs = px(pose[12]);
        const mouth = { x: (pose[9].x + pose[10].x) / 2 * W, y: (pose[9].y + pose[10].y) / 2 * H };
        const eye = { x: (pose[2].x + pose[5].x) / 2 * W, y: (pose[2].y + pose[5].y) / 2 * H };
        const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
        if (sw > 20) body = { sw, mouth, forehead: { x: eye.x, y: eye.y - (mouth.y - eye.y) }, shoulderMid: { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 } };
      }
      setBodyVisible(!!body);
      if (body && settings.showLandmarks) {
        ctx.strokeStyle = "rgba(121,87,255,0.5)"; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(body.forehead.x, body.forehead.y, 0.45 * body.sw, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(body.mouth.x, body.mouth.y, 0.4 * body.sw, 0, 7); ctx.stroke();
        ctx.strokeRect(body.shoulderMid.x - 0.65 * body.sw, body.shoulderMid.y + 0.05 * body.sw, 1.3 * body.sw, 1.05 * body.sw);
        ctx.setLineDash([]);
      }
      if (hands.length) {
        const colors = ["rgba(99,230,213,0.9)", "rgba(64,183,255,0.9)"];
        const results = hands.map((hand, i) => {
          if (settings.showLandmarks) {
            ctx.strokeStyle = colors[i % 2]!; ctx.lineWidth = 4;
            for (const [a, b] of CONNECTIONS) {
              const pa = hand[a]!, pb = hand[b]!;
              ctx.beginPath(); ctx.moveTo(pa.x * c.width, pa.y * c.height); ctx.lineTo(pb.x * c.width, pb.y * c.height); ctx.stroke();
            }
            ctx.fillStyle = "rgba(121,87,255,1)";
            for (const p of hand) { ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, 5, 0, 7); ctx.fill(); }
          }
          const side = (res.handedness?.[i]?.[0]?.categoryName as string | undefined) ?? `Hand ${i + 1}`;
          return { side, cls: classifyHandshape(hand) };
        });
        setHandsView(results);
        // Movement + body-location signs (Please, Thank you, …) per hand.
        let motionHit: { label: string; confidence: number } | null = null;
        let anyInZone = false;
        if (body) {
          const seen = new Set<string>();
          hands.forEach((hand, i) => {
            const key = results[i]!.side + i;
            seen.add(key);
            const l = results[i]!.cls.label;
            const shape: Shape = l === "B" || l === "5" ? "open" : l === "A" || l === "S" ? "fist" : l === "D" ? "index" : "other";
            const palmIdx = [0, 5, 9, 13, 17];
            const palm = { x: palmIdx.reduce((a, j) => a + hand[j]!.x, 0) / 5 * W, y: palmIdx.reduce((a, j) => a + hand[j]!.y, 0) / 5 * H };
            const f: Frame = { t: now, shape, palm, tip: px(hand[12]!), indexTip: px(hand[8]!), body: body! };
            const tr = (tracksRef.current.get(key) ?? []).filter((x) => now - x.t < 1200);
            tr.push(f);
            tracksRef.current.set(key, tr);
            if (inBodyZone(f)) anyInZone = true;
            const m = detectMotionSign(tr);
            if (m && (!motionHit || m.confidence > motionHit.confidence)) { motionHit = m; tracksRef.current.set(key, []); }
          });
          for (const k of tracksRef.current.keys()) if (!seen.has(k)) tracksRef.current.delete(k);
        }
        if (motionHit) {
          const mh = motionHit as { label: string; confidence: number };
          if (builder.current.commitWord(mh.label, mh.confidence, now)) {
            setText(builder.current.text);
            setLastWord(mh.label);
            setCurrent({ label: mh.label, kind: "word", confidence: mh.confidence });
            setStatus("recognized");
          } else if (mh.confidence < settings.threshold) setStatus("low-confidence");
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        if (anyInZone) {
          // Hand is at the face/chest: wait for a full body sign instead of reading letters.
          setStatus("tracking");
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        // The sentence uses whichever hand shows the most confident recognized sign.
        const best = [...results].sort((a, b) => (b.cls.label ? 1 : 0) - (a.cls.label ? 1 : 0) || b.cls.confidence - a.cls.confidence)[0]!.cls;
        setCurrent(best);
        const r = builder.current.push(best, now);
        setStatus(r.status);
        if (r.committed) setText(builder.current.text);
      } else {
        setHandsView([]);
        setCurrent(null);
        const r = builder.current.push(null, now);
        setStatus(r.status);
        if (builder.current.text !== text) setText(builder.current.text);
      }
      // Cheap brightness check every ~60 frames
      if (Math.floor(now / 1000) % 3 === 0 && Math.random() < 0.05) {
        const s = document.createElement("canvas"); s.width = 32; s.height = 24;
        const sc = s.getContext("2d")!; sc.drawImage(v, 0, 0, 32, 24);
        const d = sc.getImageData(0, 0, 32, 24).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += d[i]! + d[i + 1]! + d[i + 2]!;
        setLowLight(sum / (d.length / 4) / 3 < 50);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [settings.showLandmarks, settings.threshold, text]);

  const start = useCallback(async (facing = settings.facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("unavailable"); setErrMsg("Your browser doesn't support camera access. Try the latest Chrome, Safari or Edge."); return;
    }
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCam("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      if (!landmarkerRef.current) {
        setCam("loading-model");
        const { FilesetResolver, HandLandmarker, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        landmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.5,
        });
        try {
          poseRef.current = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate: "GPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          });
        } catch {
          poseRef.current = null; // Body signs unavailable; letters still work.
        }
      }
      setCam("on");
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (e?.name === "NotAllowedError") { setCam("denied"); setErrMsg("Camera access was blocked. Allow camera access in your browser's site settings, then try again."); }
      else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") { setCam("unavailable"); setErrMsg("No camera was found on this device."); }
      else { setCam("error"); setErrMsg(e?.message ? `Something went wrong: ${e.message}` : "Couldn't start the camera or AI model. Check your connection and try again."); }
    }
  }, [settings.facingMode, loop]);

  useEffect(() => {
    if (cam === "on") { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(loop); }
  }, [loop, cam]);

  const switchCamera = () => {
    const next = settings.facingMode === "user" ? "environment" : "user";
    setSettings((s) => ({ ...s, facingMode: next }));
    if (cam === "on") start(next);
  };

  const clear = () => { builder.current.clear(); setText(""); };
  const copy = async () => { await navigator.clipboard.writeText(text.trim()); toast.success("Copied to clipboard"); };
  const save = () => {
    setHistory((h) => [{ id: crypto.randomUUID(), text: text.trim(), createdAt: Date.now(), confidence: builder.current.averageConfidence, favorite: false }, ...h]);
    toast.success("Saved to history");
  };

  const active = cam === "on";
  const busy = cam === "requesting" || cam === "loading-model";
  const conf = current?.label ? Math.round(current.confidence * 100) : 0;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.2fr_1fr]">
      <h1 className="sr-only">Live ASL translator</h1>
      <section aria-label="Camera" className="relative aspect-[3/4] overflow-hidden rounded-[2rem] bg-foreground shadow-soft lg:aspect-[4/5]">
        <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""} ${active ? "" : "opacity-0"}`} />
        <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`} />

        {active && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-x-[15%] top-[18%] bottom-[22%] rounded-[2rem] border-2 border-dashed border-accent/70" />
            <p className="absolute inset-x-0 top-[12%] text-center text-sm font-semibold text-background/90">Keep your hand inside the frame</p>
            <div className={`absolute left-4 top-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold backdrop-blur ${statusInfo[status].cls}`} role="status" aria-live="polite">
              <span className="relative flex h-2 w-2"><span className="absolute h-2 w-2 animate-ping rounded-full bg-current opacity-60" /><span className="h-2 w-2 rounded-full bg-current" /></span>
              {statusInfo[status].label}
            </div>
            {handsView.length > 0 && (
              <div className="absolute right-4 top-4 flex flex-col gap-2" aria-label="Detected hands">
                {handsView.map((h, i) => (
                  <div key={i} className="min-w-16 rounded-2xl bg-card px-3 py-1.5 text-center shadow-card">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">{h.side}</div>
                    <div className="text-xl font-extrabold leading-tight">{h.cls.label ?? "?"}</div>
                    <div className="text-[10px] font-semibold text-muted-foreground">{h.cls.label ? `${Math.round(h.cls.confidence * 100)}%` : "unknown"}</div>
                  </div>
                ))}
              </div>
            )}
            {!bodyVisible && (
              <div className="absolute inset-x-4 bottom-24 rounded-2xl bg-card/90 px-3 py-2 text-center text-sm font-semibold text-foreground">
                Step back so your head and shoulders are visible for word signs.
              </div>
            )}
            {lowLight && (
              <div className="absolute inset-x-4 bottom-24 flex items-center gap-2 rounded-2xl bg-warning px-3 py-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4" aria-hidden /> It's quite dark — try more light for better accuracy.
              </div>
            )}
          </>
        )}

        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-brand p-8 text-center text-primary-foreground">
            {busy ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
                <p className="font-semibold" role="status">{cam === "requesting" ? "Waiting for camera permission…" : "Loading the hand-tracking AI…"}</p>
              </>
            ) : (
              <>
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-background/20">
                  {cam === "off" ? <Camera className="h-10 w-10" aria-hidden /> : <AlertTriangle className="h-10 w-10" aria-hidden />}
                </div>
                <div>
                  <p className="text-xl font-bold">{cam === "off" ? "Turn on your camera" : "Camera unavailable"}</p>
                  <p className="mt-1 max-w-xs text-sm opacity-90">
                    {cam === "off" ? "Signa needs camera access to see signs. Video is processed on your device and never uploaded." : errMsg}
                  </p>
                </div>
                <button onClick={() => start()} className="h-12 rounded-2xl bg-card px-6 font-bold text-foreground shadow-card transition active:scale-95">
                  {cam === "off" ? "Allow camera" : "Try again"}
                </button>
              </>
            )}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
          <button
            onClick={() => (active ? stop() : start())}
            disabled={busy}
            aria-label={active ? "Turn camera off" : "Turn camera on"}
            className="grid h-14 w-14 place-items-center rounded-full bg-card text-foreground shadow-soft transition active:scale-90 disabled:opacity-50"
          >
            {active ? <CameraOff className="h-6 w-6" aria-hidden /> : <Camera className="h-6 w-6" aria-hidden />}
          </button>
          <button onClick={switchCamera} aria-label="Switch between front and back camera" className="grid h-14 w-14 place-items-center rounded-full bg-card text-foreground shadow-soft transition active:scale-90">
            <RefreshCcw className="h-6 w-6" aria-hidden />
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {practice && (
          <div className="rounded-3xl border-2 border-primary/30 bg-card p-5" role="status">
            <p className="text-sm font-semibold text-muted-foreground">Practice</p>
            <p className="text-lg font-bold">Sign "{practice}"</p>
            <p className={`mt-1 font-semibold ${(current?.label === practice && status === "recognized") || lastWord === practice ? "text-success" : "text-muted-foreground"}`}>
              {(current?.label === practice && status === "recognized") || lastWord === practice ? <><Check className="mr-1 inline h-4 w-4" aria-hidden />Great — recognized!</> : "Hold the handshape steady in the frame."}
            </p>
          </div>
        )}
        <section aria-label="Live translation" className="rounded-[2rem] bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-extrabold tracking-widest text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-success" : "bg-muted-foreground"}`} aria-hidden />
              LIVE TRANSLATION {active ? "· ON" : "· OFF"}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              Confidence: {current?.label ? `${conf}%` : "—"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full bg-brand transition-all duration-300" style={{ width: `${conf}%` }} />
          </div>
          <p className="mt-5 min-h-24 break-words text-3xl font-bold leading-snug" aria-live="polite">
            {text.trim() ? text : <span className="text-muted-foreground/60">Recognized signs will appear here…</span>}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button onClick={clear} disabled={!text} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-muted font-semibold transition active:scale-95 disabled:opacity-40"><Trash2 className="h-4 w-4" aria-hidden />Clear</button>
            <button onClick={copy} disabled={!text.trim()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-muted font-semibold transition active:scale-95 disabled:opacity-40"><Copy className="h-4 w-4" aria-hidden />Copy</button>
            <button onClick={save} disabled={!text.trim()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-primary-foreground transition active:scale-95 disabled:opacity-40"><Save className="h-4 w-4" aria-hidden />Save</button>
          </div>
        </section>
        <section className="rounded-3xl border border-border p-5 text-sm">
          <p className="font-bold">What Signa recognizes today</p>
          <p className="mt-1 text-muted-foreground">
            Signa now tracks your body too, so it knows when a hand is at your forehead, chin or chest and how it moves. It understands the word signs below plus fingerspelled letters — not yet all of ASL, full grammar or facial expressions. Keep your head and shoulders in view for word signs.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MOTION_SIGNS.map((s) => <span key={s} className="rounded-lg bg-secondary/20 px-2 py-1 text-xs font-bold text-foreground">{s}</span>)}
            {SUPPORTED_SIGNS.map((s) => <span key={s} className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{s}</span>)}
          </div>
        </section>
      </div>
    </div>
  );
}
