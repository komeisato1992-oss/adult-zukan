type DoujinEmptyStateProps = {
  title?: string;
  description?: string;
};

export function DoujinEmptyState({
  title = "作品データを準備中です",
  description = "管理画面から FANZA 同人作品を取得すると、ここに表示されます。",
}: DoujinEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}
