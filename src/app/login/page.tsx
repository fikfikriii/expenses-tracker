"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Expenses Tracker</h1>
        <p className="text-sm text-neutral-500">Masukin password dashboard.</p>
      </div>
      <form action={action} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          autoFocus
          required
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
