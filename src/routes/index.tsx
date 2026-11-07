import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Camera, Hand, History, ScanText, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Signa — Communication without barriers" },
      { name: "description", content: "Turn ASL signs into words in real time with your phone or computer camera." },
      { property: "og:title", content: "Signa — Communication without barriers" },
      { property: "og:description", content: "Turn sign language into words. Understand more, connect better." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Zap, title: "Real-Time Translation", body: "Understand ASL gestures and convert them into text as you sign." },
  { icon: Brain, title: "Smart Recognition", body: "AI-powered hand and gesture recognition designed to understand ASL." },
  { icon: History, title: "Translation History", body: "Review previous translations and save useful phrases." },
];
const steps = [
  { icon: Camera, t: "Open your camera" },
  { icon: Hand, t: "Sign naturally in front of it" },
  { icon: Brain, t: "AI analyzes your signs" },
  { icon: ScanText, t: "Read the translated text" },
];

function Index() {
  return (
    <div className="space-y-16">
      <section className="relative overflow-hidden rounded-[2rem] bg-card px-6 py-14 text-center shadow-card md:py-24">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-brand opacity-20 blur-3xl" />
        <div className="relative animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <span className="h-2 w-2 rounded-full bg-accent" /> ASL recognition MVP · runs on your device
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
            Communication <span className="text-brand">without barriers.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Turn sign language into words. Understand more, connect better.
          </p>
          <Link
            to="/translator"
            search={{}}
            className="mt-8 inline-flex h-14 items-center gap-2 rounded-2xl bg-brand px-8 text-lg font-bold text-primary-foreground shadow-soft transition hover:-translate-y-0.5 active:scale-95"
          >
            <Camera className="h-5 w-5" aria-hidden /> Start Translating
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Features">
        {features.map((f, i) => (
          <div key={f.title} className="animate-rise rounded-3xl bg-card p-6 shadow-card transition hover:-translate-y-1" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <f.icon className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
            <p className="mt-1 text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl font-extrabold">How it works</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.t} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand font-bold text-primary-foreground">{i + 1}</span>
              <span className="font-semibold">{s.t}</span>
            </li>
          ))}
        </ol>
        <Link to="/learn" className="mt-6 inline-flex items-center gap-1 font-semibold text-primary hover:underline">
          New to ASL? Start learning <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
