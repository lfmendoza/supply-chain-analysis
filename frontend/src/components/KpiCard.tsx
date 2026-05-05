type Tone = "positive" | "negative" | "neutral";

type Props = {
  title: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
};

const toneClass: Record<Tone, string> = {
  positive: "text-emerald-600",
  negative: "text-rose-600",
  neutral: "text-slate-700"
};

export default function KpiCard({ title, value, hint, tone = "neutral" }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass[tone]}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
