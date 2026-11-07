import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Camera, CameraOff, Check, Copy, Loader2, RefreshCcw, Save, Trash2, Volume2, VolumeX, Play, Square, SlidersHorizontal, Gauge, ShieldCheck, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { classifyHandshape, SUPPORTED_SIGNS, type Classification } from "@/lib/asl/classifier";
import { detectMotionSign, inBodyZone, isMoving, MOTION_SIGNS, type Body, type Frame, type Shape } from "@/lib/asl/motion";
import { tentativeSuggestion } from "@/lib/asl/suggestion";
import { detectTwoHandSign, type PairedFrame } from "@/lib/asl/two-hand";
import { updateMotionWindow } from "@/lib/asl/motion-window";
import { needsDisplayUpdate, sameDisplayedClassification } from "@/lib/asl/live-display";
import { advancePractice, practiceSigns, PHRASE_PRACTICES, TWO_HAND_SIGNS } from "@/lib/asl/practice";
import { cameraConstraints, cameraError, inferenceSize, type CameraQuality } from "@/lib/asl/camera";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SentenceBuilder, type BuilderStatus } from "@/lib/asl/sentence";
import { useHistory, useSettings } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslationSpeech } from "@/hooks/use-translation-speech";

export const Route = createFileRoute("/translator")({
  validateSearch: (s: Record<string, unknown>): { practice?: string } =>
    typeof s['practice'] === "string" ? { practice: s['practice'] } : {},
  head: () => ({
    meta: [
      { title: "Live ASL Translator — SignBridge" },
      { name: "description", content: "Read supported ASL signs, hear translations with ElevenLabs, and type a response with SignBridge." },
      { property: "og:title", content: "Live ASL Translator — SignBridge" },
      { property: "og:description", content: "Live ASL text and spoken translations, with typed replies." },
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
  const navigate = Route.useNavigate();
  const signs = practiceSigns(practice);
  const [practiceStep, setPracticeStep] = useState(0);
  const target = signs[practiceStep];
  const experimental = TWO_HAND_SIGNS.some((s) => s === target);
  const pairRef = useRef<PairedFrame[]>([]);
  const [progress, setProgress] = useState(0);
  const [committedCount, setCommittedCount] = useState(0);
  const [settings, setSettings] = useSettings();
  const [, setHistory] = useHistory();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);
  const [activeFacing, setActiveFacing] = useState<"user" | "environment">("user");
  const modelPromiseRef = useRef<Promise<void> | null>(null);
  const inputRef = useRef<HTMLCanvasElement | null>(null);
  const lightRef = useRef<HTMLCanvasElement | null>(null);
  const lastLightRef = useRef(-Infinity);
  const metricsRef = useRef({ start: 0, frames: 0, total: 0 });
  const [metrics, setMetrics] = useState({ fps: 0, ms: 0 });
  const [cameraPanel, setCameraPanel] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [resolution, setResolution] = useState("");
  const [bodyModelReady, setBodyModelReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);
  const poseRef = useRef<any>(null);
  const tracksRef = useRef(new Map<string, Frame[]>());
  const [bodyVisible, setBodyVisible] = useState(false);
  
  const rafRef = useRef<number>(0);
  const builder = useRef(new SentenceBuilder());
  const [cam, setCam] = useState<CamState>("off");
  const [errMsg, setErrMsg] = useState("");
  const [status, setStatus] = useState<BuilderStatus>("idle");
  const [current, setCurrent] = useState<Classification | null>(null);
  const [handsView, setHandsView] = useState<{ side: string; cls: Classification }[]>([]);
  const smoothRef = useRef<{ x: number; y: number; z?: number }[][]>([]);
  const identitiesRef = useRef("");
  const videoTimeRef = useRef(-1);
  const [text, setText] = useState("");
  const [response, setResponse] = useState("");
  const speech = useTranslationSpeech(text);
  const [lowLight, setLowLight] = useState(false);
  const displayRef = useRef({ last: -Infinity, key: "" });

  const publishTracking = useCallback((candidate: Classification | null, nextStatus: BuilderStatus, now: number) => {
    const key = `${nextStatus}:${candidate?.kind ?? ""}:${candidate?.label ?? ""}`;
    if (!needsDisplayUpdate(now, displayRef.current.last, displayRef.current.key, key)) return;
    displayRef.current = { last: now, key };
    setCurrent((previous) => sameDisplayedClassification(previous, candidate) ? previous : candidate);
    setStatus(nextStatus);
    setProgress(builder.current.confirmationProgress);
  }, []);

  builder.current.threshold = settings.threshold;
  const mirrored = settings.mirror && activeFacing === "user";

  useEffect(() => {
    setPracticeStep(0);
    builder.current.resetTracking();
    tracksRef.current.clear();
    pairRef.current = [];
    setProgress(0);
  }, [practice]);

  useEffect(() => {
    builder.current.resetTracking();
    tracksRef.current.clear();
    pairRef.current = [];
    displayRef.current = { last: -Infinity, key: "" };
    setProgress(0);
    setCurrent(null);
    setStatus("idle");
  }, [practiceStep]);

  const stop = useCallback(() => {
    requestRef.current += 1;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCam("off");
    setStatus("idle");
    setCurrent(null);
    setHandsView([]);
    builder.current.resetTracking();
    tracksRef.current.clear();
    pairRef.current = [];
    setProgress(0);
    smoothRef.current = [];
    identitiesRef.current = "";
    videoTimeRef.current = -1;
    setBodyVisible(false);
    setLowLight(false);
    setMetrics({ fps: 0, ms: 0 });
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; stop(); landmarkerRef.current?.close(); poseRef.current?.close(); };
  }, [stop]);

  useEffect(() => {
    const refresh = async () => {
      try { setDevices((await navigator.mediaDevices?.enumerateDevices() ?? []).filter((d) => d.kind === "videoinput")); } catch { /* Camera permission may be required. */ }
    };
    void refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
  }, []);

  const loop = useCallback(() => {
    const v = videoRef.current, c = canvasRef.current, lmk = landmarkerRef.current;
    if (!v || !c || !lmk || !streamRef.current) return;
    try {
    if (v.readyState >= 2 && v.currentTime !== videoTimeRef.current) {
      videoTimeRef.current = v.currentTime;
      const now = performance.now();
      const input = inputRef.current ?? document.createElement("canvas");
      inputRef.current = input;
      const size = inferenceSize(v.videoWidth, v.videoHeight, settings.cameraQuality);
      if (input.width !== size.width) input.width = size.width;
      if (input.height !== size.height) input.height = size.height;
      const inputContext = input.getContext("2d");
      if (!inputContext) throw new Error("Camera frame unavailable");
      inputContext.drawImage(v, 0, 0, input.width, input.height);
      const res = lmk.detectForVideo(input, now);
      // Keep identities stable when MediaPipe changes detection array order.
      const order = (res.landmarks ?? []).map((_: unknown, i: number) => i).sort((a: number, b: number) => (res.handedness?.[a]?.[0]?.categoryName ?? "").localeCompare(res.handedness?.[b]?.[0]?.categoryName ?? ""));
      const orderedHands = order.map((i: number) => res.landmarks[i]);
      const orderedSides = order.map((i: number) => res.handedness?.[i]);
      if (c.width !== v.videoWidth) c.width = v.videoWidth;
      if (c.height !== v.videoHeight) c.height = v.videoHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      type P = { x: number; y: number; z?: number };
      const raw = orderedHands as P[][];
      const identities = raw.map((_, i) => orderedSides[i]?.[0]?.categoryName ?? `Hand ${i + 1}`).join(",");
      if (identitiesRef.current !== identities) {
        smoothRef.current = [];
        tracksRef.current.clear();
        pairRef.current = [];
        builder.current.resetTracking();
        identitiesRef.current = identities;
      }
      // Light temporal smoothing per hand to reduce jitter between frames.
      const hands = raw.map((h, i) => {
        const prev = smoothRef.current[i];
        const sm = prev && prev.length === h.length
          ? h.map((p, j) => {
            const previous = prev[j];
            return previous ? { x: p.x * 0.6 + previous.x * 0.4, y: p.y * 0.6 + previous.y * 0.4, z: (p.z ?? 0) * 0.6 + (previous.z ?? 0) * 0.4 } : p;
          })
          : h;
        return sm;
      });
      smoothRef.current = hands;
      // Body reference from pose: shoulders, mouth and forehead in pixel space.
      const W = c.width, H = c.height;
      const px = (p: { x: number; y: number }) => ({ x: p.x * W, y: p.y * H });
      let body: Body | null = null;
      const pose = poseRef.current?.detectForVideo(input, now)?.landmarks?.[0] as { x: number; y: number; visibility?: number; presence?: number }[] | undefined;
      if (pose && [11, 12, 9, 10, 2, 5].every((i) => (pose[i]?.visibility ?? 0) >= 0.7 && (pose[i]?.presence ?? 1) >= 0.7) && pose[11] && pose[12] && pose[9] && pose[10] && pose[2] && pose[5]) {
        const ls = px(pose[11]), rs = px(pose[12]);
        const mouth = { x: (pose[9].x + pose[10].x) / 2 * W, y: (pose[9].y + pose[10].y) / 2 * H };
        const eye = { x: (pose[2].x + pose[5].x) / 2 * W, y: (pose[2].y + pose[5].y) / 2 * H };
        const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
        if (sw > 20) body = { sw, mouth, forehead: { x: eye.x, y: eye.y - (mouth.y - eye.y) }, shoulderMid: { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 } };
      }
      const elapsed = performance.now() - now;
      const metric = metricsRef.current;
      if (!metric.start) metric.start = now;
      metric.frames += 1; metric.total += elapsed;
      if (now - metric.start >= 1000) {
        setMetrics({ fps: Math.round(metric.frames * 1000 / (now - metric.start)), ms: Math.round(metric.total / metric.frames) });
        metricsRef.current = { start: now, frames: 0, total: 0 };
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
            ctx.strokeStyle = colors[i % 2] ?? colors[0] ?? ""; ctx.lineWidth = 4;
            for (const [a, b] of CONNECTIONS) {
              const pa = hand[a], pb = hand[b];
              if (!pa || !pb) continue;
              ctx.beginPath(); ctx.moveTo(pa.x * c.width, pa.y * c.height); ctx.lineTo(pb.x * c.width, pb.y * c.height); ctx.stroke();
            }
            ctx.fillStyle = "rgba(121,87,255,1)";
            for (const p of hand) { ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, 5, 0, 7); ctx.fill(); }
          }
          const side = (orderedSides[i]?.[0]?.categoryName as string | undefined) ?? `Hand ${i + 1}`;
          // MediaPipe x/z use image width; y uses image height. Equalize axes.
          return { side, cls: classifyHandshape(hand.map((p) => ({ ...p, x: p.x * W / H, z: (p.z ?? 0) * W / H }))) };
        });
        setHandsView((previous) => previous.length === results.length && previous.every((hand, i) => hand.side === results[i]?.side && sameDisplayedClassification(hand.cls, results[i]?.cls ?? null)) ? previous : results);
        // Movement + body-location signs (Please, Thank you, …) per hand.
        let motionHit: { label: string; confidence: number; source: string } | null = null;
        let anyInZone = false;
        let anyMoving = false;
        const frameBySide = new Map<string, Frame>();
        if (body) {
          const seen = new Set<string>();
          hands.forEach((hand, i) => {
            const result = results[i];
            const tip = hand[12], indexTip = hand[8];
            if (!result || !tip || !indexTip || !body) return;
            const key = result.side;
            seen.add(key);
            const l = tentativeSuggestion(result.cls)?.label;
            const shape: Shape = l === "B" || l === "5" ? "open" : l === "A" || l === "S" ? "fist" : l === "D" ? "index" : "other";
            const palmIdx = [0, 5, 9, 13, 17];
            const palm = { x: palmIdx.reduce((a, j) => a + (hand[j]?.x ?? 0), 0) / 5 * W, y: palmIdx.reduce((a, j) => a + (hand[j]?.y ?? 0), 0) / 5 * H };
            const a = hand[0], b = hand[5], d = hand[17], thumb = hand[4], thumbJoint = hand[2];
            let palmNormal: Frame["palmNormal"];
            if (a && b && d) {
              const ux = (b.x - a.x) * W, uy = (b.y - a.y) * H, uz = ((b.z ?? 0) - (a.z ?? 0)) * W;
              const vx = (d.x - a.x) * W, vy = (d.y - a.y) * H, vz = ((d.z ?? 0) - (a.z ?? 0)) * W;
              const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
              const length = Math.hypot(nx, ny, nz);
              if (length > 0) palmNormal = { x: nx / length, y: ny / length, z: nz / length };
            }
            const f: Frame = { t: now, shape, shapeConfidence: result.cls.confidence, palm, tip: px(tip), indexTip: px(indexTip), body, ...(palmNormal ? { palmNormal } : {}), thumbUp: !!(thumb && thumbJoint && thumb.y < thumbJoint.y - 0.1 * body.sw / H) };
            frameBySide.set(result.side, f);
            const tr = updateMotionWindow(tracksRef.current.get(key) ?? [], f, (frame) => frame.shape);
            tracksRef.current.set(key, tr);
            if (inBodyZone(f)) anyInZone = true;
            if (isMoving(tr)) anyMoving = true;
            const m = detectMotionSign(tr);
            if (m && (!motionHit || m.confidence > motionHit.confidence)) motionHit = { ...m, source: key };
          });
          for (const k of tracksRef.current.keys()) if (!seen.has(k)) tracksRef.current.delete(k);
        } else { tracksRef.current.clear(); pairRef.current = []; }
        if (experimental && target) {
          const left = frameBySide.get("Left"), right = frameBySide.get("Right");
          if (left && right && (left.shapeConfidence ?? 0) >= Math.max(0.7, settings.threshold) && (right.shapeConfidence ?? 0) >= Math.max(0.7, settings.threshold)) {
            pairRef.current = updateMotionWindow(pairRef.current, { t: now, left, right }, (frame) => `${frame.left.shape}:${frame.right.shape}`);
          } else pairRef.current = [];
          const match = detectTwoHandSign(pairRef.current, target);
          const candidate: Classification = { label: match?.label ?? null, kind: "word", confidence: match?.confidence ?? 0 };
          const r = builder.current.push(candidate, now, "guided-pair");
          publishTracking(candidate, r.status, now);
          if (r.committed) {
            setText(builder.current.text);
            setCommittedCount((n) => n + 1);
            setPracticeStep((step) => advancePractice(signs, step, r.committed ?? ""));
          }
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        if (motionHit) {
          const mh = motionHit as { label: string; confidence: number; source: string };
          const candidate: Classification = { label: mh.label, kind: "word", confidence: mh.confidence };
          const r = builder.current.push(candidate, now, mh.source);
          publishTracking(candidate, r.status, now);
          if (r.committed) {
            setText(builder.current.text);
            setCommittedCount((n) => n + 1);
            setPracticeStep((step) => advancePractice(signs, step, mh.label));
          }
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        if (anyInZone || anyMoving) {
          // Hand is at the face/chest: wait for a full body sign instead of reading letters.
          builder.current.push({ label: null, kind: "word", confidence: 0 }, now);
          const possible = anyInZone ? null : tentativeSuggestion(results.find((r) => r.cls.label)?.cls ?? null);
          publishTracking(possible, "tracking", now);
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        // The sentence uses whichever hand shows the most confident recognized sign.
        const best = [...results].sort((a, b) => (b.cls.label ? 1 : 0) - (a.cls.label ? 1 : 0) || b.cls.confidence - a.cls.confidence)[0];
        if (!best) return;
        const r = builder.current.push(best.cls, now, best.side);
        publishTracking(best.cls, r.status, now);
        if (r.committed) {
          setText(builder.current.text);
          setCommittedCount((n) => n + 1);
          setPracticeStep((step) => advancePractice(signs, step, r.committed ?? ""));
        }
      } else {
        setHandsView((previous) => previous.length ? [] : previous);
        const r = builder.current.push(null, now);
        publishTracking(null, r.status, now);
        setText((previous) => previous === builder.current.text ? previous : builder.current.text);
      }
      // Cheap brightness check every ~60 frames
      if (now - lastLightRef.current >= 2000) {
        lastLightRef.current = now;
        const s = lightRef.current ?? document.createElement("canvas"); lightRef.current = s;
        if (s.width !== 32) s.width = 32; if (s.height !== 24) s.height = 24;
        const sc = s.getContext("2d");
        if (!sc) return;
        sc.drawImage(v, 0, 0, 32, 24);
        const d = sc.getImageData(0, 0, 32, 24).data; let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0);
        setLowLight(sum / (d.length / 4) / 3 < 50);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
    } catch (error) {
      stop();
      const failure = cameraError(error);
      setCam(failure.state); setErrMsg(failure.message);
    }
  }, [settings.cameraQuality, stop, settings.showLandmarks, settings.threshold, practice, practiceStep, publishTracking]);

  const start = useCallback(async (facing = settings.facingMode, selectedDevice = deviceId, quality: CameraQuality = settings.cameraQuality) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("unavailable"); setErrMsg("Your browser doesn't support camera access. Try Chrome, Safari or Edge."); return;
    }
    stop();
    const request = ++requestRef.current;
    setErrMsg(""); setCam("requesting");
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing, quality, selectedDevice));
      if (request !== requestRef.current) { acquired.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = acquired;
      const v = videoRef.current;
      if (!v) { stop(); return; }
      const track = acquired.getVideoTracks()[0];
      setActiveFacing(track?.getSettings().facingMode === "environment" ? "environment" : facing);
      if (track) track.onended = () => {
        if (request !== requestRef.current) return;
        stop(); setCam("error"); setErrMsg("Camera disconnected. Reconnect it or choose another camera.");
      };
      v.srcObject = acquired;
      await v.play();
      if (request !== requestRef.current) return;
      setResolution(`${v.videoWidth} × ${v.videoHeight}`);
      try { setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput")); } catch { /* Device labels are optional. */ }
      if (request !== requestRef.current) return;
      if (!landmarkerRef.current || !poseRef.current) {
        setCam("loading-model");
        if (!modelPromiseRef.current) {
          modelPromiseRef.current = (async () => {
            const { FilesetResolver, HandLandmarker, PoseLandmarker } = await import("@mediapipe/tasks-vision");
            const fileset = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm");
            const hands = (delegate: "GPU" | "CPU") => HandLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", delegate },
              runningMode: "VIDEO", numHands: 2, minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
            });
            const pose = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task", delegate }, runningMode: "VIDEO", numPoses: 1,
            });
            const [handModel, poseModel] = await Promise.all([landmarkerRef.current ? Promise.resolve(landmarkerRef.current) : hands("GPU").catch(() => hands("CPU")), pose("GPU").catch(() => pose("CPU")).catch(() => null)]);
            if (!mountedRef.current) { handModel.close(); poseModel?.close(); return; }
            landmarkerRef.current = handModel; poseRef.current = poseModel;
          })().finally(() => { modelPromiseRef.current = null; });
        }
        await modelPromiseRef.current;
      }
      if (request !== requestRef.current) return;
      setBodyModelReady(!!poseRef.current);
      metricsRef.current = { start: 0, frames: 0, total: 0 };
      setCam("on");
    } catch (error) {
      acquired?.getTracks().forEach((t) => t.stop());
      if (request !== requestRef.current) return;
      stop();
      const failure = cameraError(error);
      setCam(failure.state); setErrMsg(failure.message);
    }
  }, [settings.facingMode, settings.cameraQuality, deviceId, loop, stop]);

  useEffect(() => {
    if (cam === "on") { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(loop); }
  }, [loop, cam]);

  const switchCamera = () => {
    const next = settings.facingMode === "user" ? "environment" : "user";
    setDeviceId("");
    setSettings((s) => ({ ...s, facingMode: next }));
    if (cam === "on") void start(next, "");
  };

  const clear = () => { builder.current.clear(); tracksRef.current.clear(); pairRef.current = []; setText(""); setProgress(0); setCommittedCount(0); };
  const copy = async () => { await navigator.clipboard.writeText(text.trim()); toast.success("Copied to clipboard"); };
  const save = () => {
    setHistory((h) => [{ id: crypto.randomUUID(), text: text.trim(), createdAt: Date.now(), confidence: builder.current.averageConfidence, favorite: false }, ...h]);
    toast.success("Saved to history");
  };

  const active = cam === "on";
  const busy = cam === "requesting" || cam === "loading-model";
  const conf = current?.label ? Math.round(current.confidence * 100) : 0;
  const suggestion = active && status !== "recognized" ? tentativeSuggestion(current) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-primary"><span className="h-2 w-2 rounded-full bg-accent" /> SignBridge · Conversation</p>
          <h1 className="text-3xl font-extrabold">SignBridge Studio</h1>
        </div>
        <div className="flex gap-5 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-2"><Camera className="h-4 w-4" aria-hidden /> On-device video</span>
          <span className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden /> {committedCount} confirmed</span>
        </div>
      </header>
      <div className="grid items-start gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 space-y-3">
          <section aria-label="Camera" className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-camera shadow-soft md:aspect-[4/5]">
            <video ref={videoRef} playsInline muted className={`absolute inset-0 h-full w-full object-contain ${mirrored ? "-scale-x-100" : ""} ${active ? "" : "opacity-0"}`} />
            <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full object-contain ${mirrored ? "-scale-x-100" : ""}`} />
            {active && <>
              <div className={`absolute left-3 top-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold ${statusInfo[status].cls}`} role="status">
                <span className="h-2 w-2 rounded-full bg-current" />{statusInfo[status].label}
              </div>
              <div className="absolute right-3 top-14 flex gap-2" aria-label="Detected hands">
                {handsView.map((h) => <div key={h.side} className="rounded-lg bg-card/95 px-3 py-2 text-xs font-bold">{h.side} <span className="text-muted-foreground">· tracked</span></div>)}
              </div>
              {(!bodyVisible || lowLight) && <div className="absolute inset-x-3 bottom-20 rounded-lg bg-card/95 px-3 py-2 text-center text-xs font-semibold">{lowLight ? "Low light" : "Head and shoulders not in view"}</div>}
            </>}
            {!active && <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center text-camera-foreground">
              {busy ? <><Loader2 className="h-10 w-10 animate-spin" aria-hidden /><p role="status">{cam === "requesting" ? "Waiting for camera permission…" : "Loading hand and body tracking…"}</p><Button variant="outline" onClick={stop}>Cancel</Button></> : <>
                <div className="relative grid h-24 w-24 place-items-center rounded-2xl border border-camera-foreground/30"><Camera className="h-10 w-10" aria-hidden /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-accent" /></div>
                <div><h2 className="text-2xl font-bold">{cam === "off" ? "Ready when you are." : "Camera unavailable"}</h2><p className="mx-auto mt-2 max-w-xs text-sm text-camera-foreground/80">{cam === "off" ? "Your video stays on this device." : errMsg}</p></div>
                <Button onClick={() => start()} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90"><Camera aria-hidden />{cam === "off" ? "Start camera" : "Try again"}</Button>
              </>}
            </div>}
            <div className={`${active || busy ? "absolute inset-x-0 bottom-4" : "hidden"} flex justify-center gap-3`}>
              <Button size="icon" variant="outline" onClick={() => active ? stop() : start()} disabled={busy} aria-label={active ? "Turn camera off" : "Turn camera on"} title={active ? "Turn camera off" : "Turn camera on"} className="h-11 w-11 rounded-full">{active ? <CameraOff aria-hidden /> : <Camera aria-hidden />}</Button>
              <Button size="icon" variant="outline" onClick={() => setCameraPanel((open) => !open)} aria-label="Camera settings" title="Camera settings" className="h-11 w-11 rounded-full"><SlidersHorizontal aria-hidden /></Button>
              <Button size="icon" variant="outline" onClick={switchCamera} disabled={busy} aria-label="Switch between front and back camera" title="Switch camera" className="h-11 w-11 rounded-full"><RefreshCcw aria-hidden /></Button>
            </div>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" aria-hidden />{active ? `${metrics.fps} fps · ${metrics.ms} ms tracking` : "Tracking offline"}</span>
            <span>{handsView.length} / 2 hands · {bodyVisible && active ? "Body visible" : "Body not detected"}</span>
            <Button variant="ghost" size="sm" onClick={() => setCameraPanel((open) => !open)} aria-expanded={cameraPanel}><SlidersHorizontal aria-hidden />Camera settings</Button>
          </div>
          {active && !bodyModelReady && <p role="alert" className="text-sm text-destructive">Body tracking unavailable; only handshapes can be read. Restart the camera to retry.</p>}
          {cameraPanel && <section aria-label="Camera settings" className="space-y-4 border-y border-border py-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-bold">Camera settings</h2><span className="text-xs text-muted-foreground">{active ? resolution : "Camera off"}</span></div>
            <Select value={deviceId || "default"} disabled={busy} onValueChange={(value) => { const id = value === "default" ? "" : value; setDeviceId(id); if (active) void start(settings.facingMode, id); }}>
              <SelectTrigger aria-label="Camera device"><SelectValue placeholder="Choose camera" /></SelectTrigger>
              <SelectContent><SelectItem value="default">Default {settings.facingMode === "user" ? "front" : "rear"} camera</SelectItem>{devices.filter((d) => d.deviceId).map((d, i) => <SelectItem key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2" aria-label="Camera quality">{(["balanced", "detail"] as const).map((quality) => <Button key={quality} disabled={busy} variant={settings.cameraQuality === quality ? "default" : "outline"} aria-pressed={settings.cameraQuality === quality} onClick={() => { setSettings((s) => ({ ...s, cameraQuality: quality })); if (active) void start(settings.facingMode, deviceId, quality); }}>{quality === "balanced" ? "Balanced" : "High detail"}</Button>)}</div>
            <div className="flex items-center justify-between gap-3"><label htmlFor="studio-mirror" className="text-sm">Mirror front camera</label><Switch id="studio-mirror" checked={settings.mirror} onCheckedChange={(mirror) => setSettings((s) => ({ ...s, mirror }))} /></div>
            <div className="flex items-center justify-between gap-3"><label htmlFor="studio-overlay" className="text-sm">Tracking overlay</label><Switch id="studio-overlay" checked={settings.showLandmarks} onCheckedChange={(showLandmarks) => setSettings((s) => ({ ...s, showLandmarks }))} /></div>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => start()}><RotateCcw aria-hidden />Restart camera</Button>
          </section>}

        </div>
        <div className="min-w-0 space-y-6">
          <section aria-label="Live translation" className="border-b border-border pb-6">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-bold"><span className={`h-2 w-2 rounded-full ${active ? "bg-success" : "bg-muted-foreground"}`} />Live Translation</h2><span className="text-xs font-semibold text-muted-foreground">{active ? "Live" : "Camera off"}</span></div>
            <p className="my-5 min-h-24 break-words text-3xl font-bold leading-snug" aria-live="polite">{text.trim() ? text : <span className="text-muted-foreground/60">Waiting for a confirmed sign…</span>}</p>
            <div aria-label="Tentative match" className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-2 border-l-2 border-secondary pl-3 text-sm">
              <span className="text-muted-foreground">Possible sign · not confirmed</span>
              <span className="font-semibold text-foreground">{suggestion ? `${suggestion.label} · ${Math.round(suggestion.confidence * 100)}%` : "—"}</span>
            </div>
            <div className="space-y-2 rounded-lg bg-muted/60 p-3">
              <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold"><span>{status === "recognized" ? "Sign confirmed" : status === "tracking" && current?.label ? "Confirming…" : "Awaiting a clear match"}</span><span className="text-muted-foreground">Rule match {current?.label ? `${conf}%` : "—"}</span></div>
              <progress aria-label="Sign confirmation progress" value={status === "tracking" || status === "recognized" ? progress : 0} max={1} className="confirmation-meter h-1.5 w-full" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <Button variant="ghost" size="icon" onClick={speech.toggle} aria-pressed={speech.enabled} aria-label={speech.enabled ? "Mute automatic speech" : "Enable automatic speech"} title={speech.enabled ? "Mute automatic speech" : "Enable automatic speech"}>{speech.enabled ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}</Button>
              <span className="mr-auto text-xs text-muted-foreground" role="status">{speech.state === "loading" ? "Preparing voice…" : speech.state === "speaking" ? "Speaking…" : speech.enabled ? "ElevenLabs · Voice on" : "Voice muted"}</span>
              <Button variant="ghost" size="icon" disabled={!text.trim()} onClick={speech.replay} aria-label="Play translation" title="Play translation"><Play aria-hidden /></Button>
              <Button variant="ghost" size="icon" disabled={speech.state === "idle"} onClick={speech.cancel} aria-label="Stop speaking" title="Stop speaking"><Square aria-hidden /></Button>
              <Button variant="ghost" size="icon" disabled={!text.trim()} onClick={copy} aria-label="Copy translation" title="Copy translation"><Copy aria-hidden /></Button>
              <Button variant="ghost" size="icon" disabled={!text.trim()} onClick={save} aria-label="Save translation" title="Save translation"><Save aria-hidden /></Button>
              <Button variant="ghost" size="icon" disabled={!text} onClick={clear} aria-label="Clear translation" title="Clear translation"><Trash2 aria-hidden /></Button>
            </div>
            {speech.error && <p className="mt-2 text-sm text-destructive" role="alert">{speech.error}</p>}
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Voice sends confirmed text to ElevenLabs. Video is never uploaded.</p>
          </section>
          <section aria-label="Response">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold"><label htmlFor="conversation-response">Response</label></h2><Button variant="ghost" size="icon" disabled={!response} onClick={() => setResponse("")} aria-label="Clear response" title="Clear response"><Trash2 aria-hidden /></Button></div>
            <Textarea id="conversation-response" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Type your reply…" className="min-h-36 rounded-lg bg-card text-2xl font-semibold leading-relaxed md:text-2xl" />
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick replies">{["Thank you!", "Could you repeat that?", "How can I help?"].map((reply) => <Button key={reply} variant="outline" size="sm" onClick={() => setResponse(reply)} className="h-auto min-h-8 whitespace-normal text-left">{reply}</Button>)}</div>
          </section>
        </div>
      </div>
      <section className="border-t border-border pt-6" aria-label="Guided practice">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Phrase practice</h2><span className="text-xs font-semibold text-muted-foreground">Selected sign sequences · experimental two-hand matches</span></div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Select value={signs.length && practice ? practice : "free"} onValueChange={(value) => navigate({ search: value === "free" ? {} : { practice: value } })}>
            <SelectTrigger aria-label="Phrase practice sequence"><SelectValue placeholder="Choose practice" /></SelectTrigger>
            <SelectContent><SelectItem value="free">Free conversation</SelectItem>{[...PHRASE_PRACTICES.map((p) => p.title), ...TWO_HAND_SIGNS].map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
          </Select>
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden />70% minimum · over 2 seconds</span>
        </div>
        {practice && signs.length > 0 && <div className="mt-4 border-l-2 border-primary pl-4" role="status">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{practice}</h3><Button variant="ghost" size="sm" onClick={() => { setPracticeStep(0); builder.current.resetTracking(); tracksRef.current.clear(); pairRef.current = []; setProgress(0); }}>Restart</Button></div>
          <div className="mt-2 flex flex-wrap gap-3">{signs.map((sign, i) => <span key={`${sign}-${i}`} className={`flex items-center gap-1.5 text-sm ${i < practiceStep ? "font-semibold text-success" : i === practiceStep ? "font-bold text-primary" : "text-muted-foreground"}`}>{i < practiceStep ? <Check className="h-4 w-4" aria-hidden /> : <span>{i + 1}.</span>}{sign}</span>)}</div>
          <p className="mt-2 text-sm text-muted-foreground">{practiceStep === signs.length ? "Sequence complete." : experimental ? "Experimental two-hand practice. Repeat the movement; only continuous evidence above the threshold is confirmed." : `Current sign: ${target}. A match must remain at least 70% for over two seconds.`}</p>
          {experimental && <a className="mt-2 inline-block text-sm font-semibold text-primary underline" target="_blank" rel="noreferrer" href={target === "Help" ? "https://www.lifeprint.com/asl101/pages-signs/h/help.htm" : target === "Meet" ? "https://www.lifeprint.com/asl101/pages-signs/m/meet.htm" : "https://www.lifeprint.com/asl101/pages-signs/n/nice.htm"}>ASL University reference ↗</a>}
        </div>}
      </section>
      <section className="border-t border-border pt-5 text-sm">
        <h2 className="font-bold">Supported vocabulary</h2>
        <p className="mt-2 max-w-3xl text-muted-foreground">Selected signs, not full ASL sentence translation. Two-hand practice is experimental; rule-match percentages are not measured accuracy. Not a replacement for an interpreter.</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">{[...MOTION_SIGNS, ...SUPPORTED_SIGNS].map((sign) => <span key={sign} className="text-muted-foreground">{sign}</span>)}</div>
      </section>
    </div>
  );
}
