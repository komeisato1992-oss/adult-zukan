type UpdatedDateProps = {
  date: string;
  label?: string;
  className?: string;
};

export function UpdatedDate({
  date,
  label = "更新日",
  className,
}: UpdatedDateProps) {
  return (
    <p className={className ?? "text-xs text-muted"}>
      {label}:{" "}
      <time dateTime={date}>{date}</time>
    </p>
  );
}
