type PageHeaderProps = {
  title: string;
  description: string;
};

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-600 sm:text-base dark:text-gray-400">
        {description}
      </p>
    </header>
  );
}
