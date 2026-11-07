import { Link } from "@tanstack/react-router";
import { BookOpen, History, Home, Info, Settings, Video } from "lucide-react";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-extrabold text-lg tracking-tight" aria-label="SLai home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-primary-foreground shadow-soft">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.5 15a1.6 1.6 0 0 1 2.6-1.8L8 15" />
        </svg>
      </span>
      SLai
    </Link>
  );
}

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/translator", label: "Translator", icon: Video },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/history", label: "History", icon: History },
  { to: "/about", label: "About", icon: Info },
] as const;

export function SiteNav() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "bg-card text-foreground shadow-card" }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/settings"
            aria-label="Settings"
            className="grid h-11 w-11 place-items-center rounded-full bg-card shadow-card transition hover:scale-105 active:scale-95"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <nav
        aria-label="Main mobile"
        className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-3xl border border-border bg-card/95 p-1.5 shadow-soft backdrop-blur md:hidden"
      >
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeOptions={{ exact: l.to === "/" }}
            className="flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition active:scale-95"
            activeProps={{ className: "bg-primary/10 text-primary" }}
          >
            <l.icon className="h-5 w-5" aria-hidden />
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
