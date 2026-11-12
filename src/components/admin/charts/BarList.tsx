// Horizontal bar list (server-rendered, logical CSS so it also works in RTL).
export interface BarItem {
  key: string;
  label: string;
  value: number;
  display: string;
  hint?: string;
}

export function BarList({ items, emptyLabel }: { items: BarItem[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="py-6 text-stone">{emptyLabel}</p>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex justify-between gap-3">
            <span>{item.label}</span>
            <span className="tabular-nums text-stone">
              {item.display}
              {item.hint ? <span className="ms-2 text-eyebrow text-muted">{item.hint}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-pill bg-linen">
            <div className="h-2 rounded-pill bg-terracotta" style={{ inlineSize: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
