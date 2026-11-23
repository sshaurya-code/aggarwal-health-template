"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const icons = {
  family: "M16 19v-1.5a3.5 3.5 0 00-3.5-3.5h-5A3.5 3.5 0 004 17.5V19M10 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM20 19v-1.5a3.5 3.5 0 00-2.6-3.4M15.5 4.1a3.5 3.5 0 010 6.8",
  records: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6",
  investments: "M3 17l6-6 4 4 8-8M15 7h6v6",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
};

function Tab({ href, label, icon, active }: { href: string; label: string; icon: keyof typeof icons; active: boolean }) {
  return (
    <Link href={href} className={`flex flex-1 flex-col items-center gap-0.5 pt-1.5 text-[10px] font-medium ${active ? "text-accent" : "text-ink2"}`}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icons[icon]} />
      </svg>
      {label}
    </Link>
  );
}

export function TabBar() {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  // iOS can leave a fixed bar where the keyboard's top edge was until the next scroll; re-placing it puts it back.
  useEffect(() => {
    const replace = () =>
      requestAnimationFrame(() => {
        const el = nav.current;
        if (!el) return;
        el.style.display = "none";
        void el.offsetHeight;
        el.style.display = "";
      });
    replace();
    window.visualViewport?.addEventListener("resize", replace);
    window.addEventListener("focusout", replace);
    return () => {
      window.visualViewport?.removeEventListener("resize", replace);
      window.removeEventListener("focusout", replace);
    };
  }, [path]);
  // On someone's profile, Records opens just their records; everywhere else, the whole family's.
  const member = path.match(/^\/m\/([0-9a-f-]{36})/)?.[1];
  return (
    <nav
      ref={nav}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-sep backdrop-blur-xl"
      style={{ background: "var(--bar)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex h-[52px] max-w-xl items-start">
        <Tab href="/" label="Family" icon="family" active={path === "/" || path.startsWith("/m/")} />
        <Tab href={member ? `/records?owner=${member}` : "/records"} label="Records" icon="records" active={path.startsWith("/records") || path.startsWith("/d/")} />
        <Link href="/upload" aria-label="Upload a document" className="tap -mt-3 flex flex-1 justify-center">
          <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </Link>
        <Tab href="/investments" label="Investments" icon="investments" active={path.startsWith("/investments")} />
        <Tab href="/settings" label="Settings" icon="settings" active={path.startsWith("/settings")} />
      </div>
    </nav>
  );
}
