"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(
        requested ? "/api/auth/password-reset/confirm" : "/api/auth/password-reset/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requested ? { email, code, newPassword } : { email }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Password recovery failed.");

      if (requested) {
        setMessage(data.message);
      } else {
        setRequested(true);
        setMessage(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password recovery failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold text-gray-900">Reset your password</h2>
      <p className="mb-6 text-sm text-gray-600">
        A one-time code will be sent to the app&apos;s configured recovery email.
      </p>

      <form onSubmit={submit} className="space-y-4">
        {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <Input
          label="Account email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          readOnly={requested}
        />

        {requested && (
          <>
            <Input
              label="Six-digit code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              required
            />
            <Input
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={100}
              required
            />
          </>
        )}

        <Button type="submit" className="w-full" loading={loading} disabled={!email || (requested && (code.length !== 6 || newPassword.length < 8))}>
          {requested ? "Reset password" : "Send recovery code"}
        </Button>
      </form>

      {requested && (
        <button
          type="button"
          onClick={() => { setRequested(false); setCode(""); setNewPassword(""); setMessage(""); setError(""); }}
          className="mt-4 w-full text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          Request a new code
        </button>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">Back to sign in</Link>
      </p>
    </div>
  );
}
