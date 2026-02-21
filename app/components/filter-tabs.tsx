"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface FilterTabsProps {
  current: string;
  counts: Record<string, number>;
  total: number;
}

const tabs = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "merged", label: "Merged" },
  { key: "closed", label: "Closed" },
];

export function FilterTabs({ current, counts, total }: FilterTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("status");
    } else {
      params.set("status", key);
    }
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex gap-1 mb-6 bg-card border border-card-border rounded-lg p-1">
      {tabs.map((tab) => {
        const count = tab.key === "all" ? total : counts[tab.key] || 0;
        const isActive = current === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => handleFilter(tab.key)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground hover:bg-background"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 text-xs ${isActive ? "opacity-80" : "opacity-60"}`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
