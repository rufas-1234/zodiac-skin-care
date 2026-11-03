type Props = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.32em] text-[#b87580]">{eyebrow}</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-[#382a2a] sm:text-3xl md:text-4xl">{title}</h2>
      </div>
      {description ? <p className="max-w-xl text-sm leading-7 text-[#5d4c4b]">{description}</p> : null}
    </div>
  );
}
