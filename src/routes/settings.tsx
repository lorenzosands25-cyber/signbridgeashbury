import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { defaultSettings, useHistory, useSettings } from "@/lib/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SignBridge" },
      { name: "description", content: "Camera, translation, text size, theme and privacy settings for SignBridge." },
      { property: "og:title", content: "Settings — SignBridge" },
      { property: "og:description", content: "Customize SignBridge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}
function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id}><span className="font-semibold">{label}</span>{hint && <span className="block text-sm text-muted-foreground">{hint}</span>}</label>
      {children}
    </div>
  );
}

function SettingsPage() {
  const [s, set] = useSettings();
  const [, setHistory] = useHistory();
  const up = (p: Partial<typeof defaultSettings>) => set((x) => ({ ...x, ...p }));
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-extrabold">Settings</h1>
      <Card title="Camera">
        <Row id="facing" label="Default camera" hint={s.facingMode === "user" ? "Front-facing" : "Rear-facing"}>
          <Button id="facing" variant="outline" onClick={() => up({ facingMode: s.facingMode === "user" ? "environment" : "user" })}>Switch</Button>
        </Row>
        <Row id="mirror" label="Mirror front camera"><Switch id="mirror" checked={s.mirror} onCheckedChange={(v) => up({ mirror: v })} /></Row>
        <Row id="lm" label="Show hand tracking overlay"><Switch id="lm" checked={s.showLandmarks} onCheckedChange={(v) => up({ showLandmarks: v })} /></Row>
        <div className="grid grid-cols-2 gap-2" aria-label="Camera quality">
          {(["balanced", "detail"] as const).map((quality) => <Button key={quality} variant={s.cameraQuality === quality ? "default" : "outline"} aria-pressed={s.cameraQuality === quality} onClick={() => up({ cameraQuality: quality })}>{quality === "balanced" ? "Balanced" : "High detail"}</Button>)}
        </div>
      </Card>
      <Card title="Translation">
        <div>
          <p className="font-semibold">Minimum confidence: {Math.round(Math.max(0.7, s.threshold) * 100)}%</p>
          <Slider aria-label="Minimum confidence" min={70} max={95} step={5} value={[Math.max(70, s.threshold * 100)]} onValueChange={([v]) => up({ threshold: (v ?? 70) / 100 })} />
        </div>
      </Card>
      <Card title="Display">
        <div>
          <p className="mb-3 font-semibold">Text size: {Math.round(s.textScale * 100)}%</p>
          <Slider aria-label="Text size" min={90} max={140} step={10} value={[s.textScale * 100]} onValueChange={([v]) => up({ textScale: (v ?? 100) / 100 })} />
        </div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Theme">
          {(["light", "dark"] as const).map((t) => (
            <Button key={t} variant={s.theme === t ? "default" : "outline"} role="radio" aria-checked={s.theme === t} onClick={() => up({ theme: t })} className="h-12 capitalize">
              {t === "light" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />} {t}
            </Button>
          ))}
        </div>
      </Card>
      <Card title="Data & privacy">
        <p className="text-muted-foreground">Camera video is processed entirely on your device by the hand-tracking AI. Nothing is recorded or uploaded. Saved translations are stored only in this browser.</p>
        <Button variant="destructive" onClick={() => { if (confirm("Delete all translation history?")) { setHistory([]); toast.success("History cleared"); } }} className="h-12 w-full">Clear translation history</Button>
      </Card>
    </div>
  );
}
