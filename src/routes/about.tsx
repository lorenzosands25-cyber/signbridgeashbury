import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SignBridge — Making every conversation possible" },
      { name: "description", content: "How SignBridge recognizes ASL handshapes, what it supports today, and where it's going." },
      { property: "og:title", content: "About SignBridge" },
      { property: "og:description", content: "Making every conversation possible." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-4xl font-extrabold">Making every conversation <span className="text-brand">possible.</span></h1>
      <p className="text-lg text-muted-foreground">SignBridge helps bridge the gap between Deaf and hard-of-hearing people and those who don't know American Sign Language.</p>
      <section className="rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">How it works</h2>
        <p className="mt-2 text-muted-foreground">Google's MediaPipe hand-tracking model finds 21 points on your hand in every video frame, right on your device. SignBridge analyzes the shape of your fingers to identify supported ASL handshapes, and only adds a sign once it has been held steadily with high confidence.</p>
      </section>
      <section className="rounded-3xl bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold">Honest limits</h2>
        <p className="mt-2 text-muted-foreground">Today SignBridge supports selected fingerspelling handshapes and six body-aware word signs. Guided practice also offers experimental two-hand candidates for Help, Nice / Clean, and Meet, plus short sign sequences. Confidence scores measure rule matches, not validated translation accuracy. Full ASL grammar, facial expressions, and natural sentence translation are not supported. It is not a replacement for a qualified interpreter; real-world accuracy still needs evaluation with fluent signers.</p>
      </section>
    </div>
  );
}
