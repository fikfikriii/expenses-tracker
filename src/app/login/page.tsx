"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Expenses Tracker</h1>
        <p className="text-sm text-neutral-500">Login pakai username Telegram dan password yang lu buat di bot.</p>
      </div>
      <form action={action} className="flex flex-col gap-3">
        <input
          type="text"
          name="username"
          autoFocus
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Username Telegram (tanpa @)"
          className="input"
        />
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="input"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Masuk..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
