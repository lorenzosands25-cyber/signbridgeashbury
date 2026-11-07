import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { SUPPORTED_SIGNS } from "@/lib/asl/classifier";
import { MOTION_SIGNS } from "@/lib/asl/motion";
import { PHRASE_PRACTICES, TWO_HAND_SIGNS } from "@/lib/asl/practice";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/learn")({
  head: () => ({
    meta: [
      { title: "Learn ASL — SignBridge" },
      { name: "description", content: "Beginner ASL lessons: greetings, phrases, numbers and the alphabet, with practice." },
      { property: "og:title", content: "Learn ASL — SignBridge" },
      { property: "og:description", content: "Beginner-friendly American Sign Language lessons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Learn,
});

type Lesson = { word: string; how: string; slug: string };
// Descriptions follow standard references (Lifeprint / ASL University, HandSpeak).
// Demonstrations link to Lifeprint's verified video lessons.
const LP = (s: string) => `https://www.lifeprint.com/asl101/pages-signs/${s}`;
const categories: Record<string, Lesson[]> = {
  Greetings: [
    { word: "Hello", how: "Flat hand, fingers together, starts near your forehead and moves outward, like a small salute.", slug: LP("h/hello.htm") },
    { word: "Goodbye", how: "Open hand facing out; fold the fingers down and up a couple of times, like a wave.", slug: LP("g/goodbye.htm") },
    { word: "Nice to meet you", how: "Sign NICE (flat hand slides across the other palm), then MEET (two index fingers come together), then point to the person.", slug: LP("n/nice-to-meet-you.htm") },
  ],
  "Common phrases": [
    { word: "Thank you", how: "Fingertips of a flat hand touch your chin, then move forward and down toward the person.", slug: LP("t/thankyou.htm") },
    { word: "Please", how: "Flat hand on your chest, moving in a small circle.", slug: LP("p/please.htm") },
    { word: "Sorry", how: "A-handshape (fist, thumb at the side) circling on your chest.", slug: LP("s/sorry.htm") },
    { word: "I love you", how: "Thumb, index and pinky extended; middle and ring fingers down. Palm faces out.", slug: LP("i/iloveyou.htm") },
  ],
  Numbers: [
    { word: "1", how: "Index finger up, palm facing you.", slug: LP("n/numbers1-10.htm") },
    { word: "2", how: "Index and middle fingers up and apart, palm facing you.", slug: LP("n/numbers1-10.htm") },
    { word: "3", how: "Thumb, index and middle fingers extended.", slug: LP("n/numbers1-10.htm") },
    { word: "5", how: "All five fingers spread open.", slug: LP("n/numbers1-10.htm") },
  ],
  Alphabet: [
    { word: "A", how: "Closed fist with the thumb resting against the side of the index finger.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "B", how: "Four fingers straight up and together, thumb folded across the palm.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "C", how: "Fingers and thumb curve together into a C shape, like holding a small cup.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "D", how: "Index finger up; the other fingertips touch the thumb to form a circle.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "F", how: "Thumb and index fingertips touch in a circle; the other three fingers point up and spread.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "I", how: "Fist with only the pinky finger raised.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "L", how: "Index finger up and thumb out to the side, forming an L.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "O", how: "All fingertips curve to touch the thumb, forming an O.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "S", how: "Closed fist with the thumb wrapped across the front of the fingers.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "U", how: "Index and middle fingers straight up and together.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "V", how: "Index and middle fingers up and spread apart.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "W", how: "Index, middle and ring fingers up and spread; thumb holds the pinky.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
    { word: "Y", how: "Thumb and pinky extended, other fingers folded.", slug: "https://www.lifeprint.com/asl101/fingerspelling/abc.htm" },
  ],
  "Everyday conversation": [
    { word: "Yes", how: "S-handshape (fist) nodding up and down at the wrist, like a head nodding.", slug: LP("y/yes.htm") },
    { word: "No", how: "Index and middle fingers snap closed onto the thumb.", slug: LP("n/no.htm") },
    { word: "Help", how: "A-hand (thumb up) resting on the flat palm of the other hand; both lift up together.", slug: LP("h/help.htm") },
    { word: "Nice / Clean", how: "Move a flat hand across the upward-facing palm of the other hand. NICE and CLEAN share this sign; context determines meaning.", slug: LP("n/nice.htm") },
    { word: "Meet", how: "Raise both index fingers and bring the hands toward each other until the lower parts of the hands meet.", slug: LP("m/meet.htm") },
  ],
};

function Learn() {
  const cats = Object.keys(categories);
  const [cat, setCat] = useState(cats[0] ?? "Greetings");
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Learn ASL</h1>
      <p className="mt-1 text-muted-foreground">Beginner lessons with demonstrations from Lifeprint (ASL University).</p>
      <section className="my-6 border-y border-border py-5" aria-label="Phrase sequences">
        <h2 className="mb-3 text-lg font-bold">Phrase sequences</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PHRASE_PRACTICES.map((phrase) => <div key={phrase.title} className="flex items-center justify-between gap-3">
            <div><p className="font-semibold">{phrase.title}</p><p className="text-xs text-muted-foreground">{phrase.signs.join(" → ")}</p></div>
            <Button asChild variant="outline" size="sm"><Link to="/translator" search={{ practice: phrase.title }}><Play aria-hidden />Practice</Link></Button>
          </div>)}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Guided sign sequences, not automatic sentence translation. Two-hand matches are experimental.</p>
      </section>
      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2" role="tablist">
        {cats.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={`h-11 shrink-0 rounded-full px-5 font-semibold transition active:scale-95 ${cat === c ? "bg-brand text-primary-foreground shadow-soft" : "bg-card shadow-card"}`}>
            {c}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(categories[cat] ?? []).map((l, i) => {
          const practicable = ([...SUPPORTED_SIGNS, ...MOTION_SIGNS, ...TWO_HAND_SIGNS] as readonly string[]).includes(l.word);
          return (
            <article key={l.word} className="animate-rise flex flex-col rounded-3xl bg-card p-5 shadow-card" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="grid h-24 place-items-center rounded-2xl bg-primary/10 text-4xl font-extrabold text-primary">{l.word}</div>
              <p className="mt-4 flex-1 text-muted-foreground">{l.how}</p>
              <div className="mt-4 flex gap-2">
                <a href={l.slug} target="_blank" rel="noreferrer" className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-muted text-sm font-semibold">
                  <ExternalLink className="h-4 w-4" aria-hidden /> Watch demo
                </a>
                {practicable ? (
                  <Link to="/translator" search={{ practice: l.word }} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-brand text-sm font-semibold text-primary-foreground">
                    <Play className="h-4 w-4" aria-hidden /> Practice
                  </Link>
                ) : (
                  <span className="flex h-11 flex-1 items-center justify-center rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">Practice coming soon</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
