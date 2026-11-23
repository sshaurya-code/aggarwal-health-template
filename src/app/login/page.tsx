"use client";

import { useActionState } from "react";
import { login } from "../actions";
import { FAMILY_NAME } from "@/lib/brand";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-black px-6 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- blurred backdrop from the same photo */}
      <img src="/lock.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl brightness-[0.55] saturate-150" />
      <div className="flex-1" />
      {/* The whole house, edge to edge, melting into the backdrop at top and bottom. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static photo */}
      <img
        src="/lock.jpg"
        alt="Our home"
        fetchPriority="high"
        className="relative -mx-6 mt-[calc(env(safe-area-inset-top)+28px)] aspect-[4/3] w-[calc(100%+3rem)] max-w-none object-cover [mask-image:linear-gradient(180deg,transparent_0%,black_14%,black_80%,transparent_100%)]"
      />
      <div className="flex-[1.6]" />
      <div className="relative mx-auto w-full max-w-sm [padding-bottom:calc(env(safe-area-inset-bottom)+40px)]">
        <h1 className="text-center text-[34px] leading-tight font-bold tracking-tight [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">{FAMILY_NAME}</h1>
        <p className="mt-1 text-center text-[15px] opacity-85">Enter your PIN</p>
        <form action={action} className="mt-6">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            autoFocus
            required
            className="h-14 w-full rounded-2xl bg-white/15 text-center text-[24px] tracking-[0.5em] text-white ring-1 ring-white/30 outline-none backdrop-blur-xl placeholder:text-white/50 focus:bg-white/25"
            aria-label="PIN"
          />
          {state?.error && <p className="mt-3 text-center text-[15px] font-semibold">{state.error}</p>}
          <button disabled={pending} className="tap mt-4 h-[50px] w-full rounded-2xl bg-white text-[17px] font-semibold text-black shadow-lg disabled:opacity-60">
            {pending ? "Checking…" : "Unlock"}
          </button>
        </form>
        <p className="mt-8 text-center text-[13px] opacity-70">Private to the family.</p>
      </div>
    </main>
  );
}
