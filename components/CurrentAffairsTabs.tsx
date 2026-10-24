import Link from "next/link";
import { clsx } from "clsx";

export function CurrentAffairsTabs({ active }: { active: "daily" | "monthly" | "important" }) {
  const tabs = [
    { id: "daily", label: "Daily", href: "/current-affairs" },
    { id: "monthly", label: "Monthly", href: "/current-affairs/monthly" },
    { id: "important", label: "Important", href: "/current-affairs/important" },
  ] as const;

  return (
    <div className="inline-flex bg-gray-100 rounded-full p-1 gap-1 mb-5" role="tablist" aria-label="Current affairs views">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          role="tab"
          aria-selected={active === t.id}
          className={clsx(
            "px-4 py-1.5 text-sm font-medium rounded-full transition-all",
            active === t.id ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export default CurrentAffairsTabs;
