"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinIndexPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    router.push(`/join/${cleaned}`);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-4xl">Join a room</h1>
      <p className="mt-2 text-ink-soft/75">Enter the code on the big screen.</p>
      <form onSubmit={onSubmit} className="bf-panel mt-8 rounded-[1.5rem] p-6">
        <label className="bf-label" htmlFor="code">
          Room code
        </label>
        <input
          id="code"
          className="bf-input text-center font-display text-3xl tracking-[0.3em] uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={8}
          placeholder="ABC123"
          autoComplete="off"
          required
        />
        <button type="submit" className="bf-btn bf-btn-primary mt-5 w-full">
          Continue
        </button>
      </form>
    </main>
  );
}
