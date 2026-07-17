type PageIntroProps = {
  text: string;
};

export function PageIntro({ text }: PageIntroProps) {
  return (
    <p className="mt-3 max-w-3xl break-words text-sm leading-relaxed text-muted sm:text-base">
      {text}
    </p>
  );
}
