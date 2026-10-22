"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Wallet } from "lucide-react";
import Button from "@/components/ui/Button";

interface Balance {
  supported: boolean;
  balance?: number;
  totalCredits?: number;
  totalUsage?: number;
  keyLimit?: {
    limit: number;
    remaining: number;
    resetInterval?: string | null;
    resetsAt?: string | null;
  } | null;
}

function money(n: number): string {
  return `$${n > 0 && n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`;
}

export function OpenRouterBalance() {
  const [data, setData] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (data && !data.supported) return null;

  const noCredits = data?.balance !== undefined && data.balance <= 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Wallet size={15} aria-hidden="true" />
          OpenRouter balance
        </p>
        <Button variant="ghost" size="sm" onClick={load} loading={loading} aria-label="Refresh balance">
          <RefreshCw size={13} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {failed ? (
        <p className="text-sm text-gray-500">Couldn&apos;t load the balance. Try Refresh.</p>
      ) : !data ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          {data.balance !== undefined && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Credits left</dt>
              <dd className={`font-semibold ${noCredits ? "text-red-600" : "text-gray-900"}`}>
                {money(Math.max(data.balance, 0))}
                <span className="text-xs font-normal text-gray-400">
                  {" "}
                  of {money(data.totalCredits ?? 0)} bought
                </span>
              </dd>
            </div>
          )}
          {data.keyLimit && (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">
                This key&apos;s {data.keyLimit.resetInterval ? `${data.keyLimit.resetInterval} ` : ""}limit left
              </dt>
              <dd className="font-medium text-gray-900">
                {money(data.keyLimit.remaining)}
                <span className="text-xs font-normal text-gray-400"> of {money(data.keyLimit.limit)}</span>
              </dd>
            </div>
          )}
        </dl>
      )}

      {noCredits && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
          You have no credits, so the <strong>Paid</strong> models will fail until you add some. The Free models still
          work, within their daily limits.
        </p>
      )}
      <p className="text-xs text-gray-400 mt-3">
        Add credits at{" "}
        <a
          href="https://openrouter.ai/credits"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          openrouter.ai/credits
        </a>
        . The balance can lag a few minutes behind your latest usage.
      </p>
    </div>
  );
}

export default OpenRouterBalance;
