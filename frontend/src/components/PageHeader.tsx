type Props = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
};

export default function PageHeader({ title, description, actions, badge }: Props) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1.5 text-sm text-slate-600 max-w-3xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
