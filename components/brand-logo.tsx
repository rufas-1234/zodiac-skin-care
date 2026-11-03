import Image from 'next/image';

export function BrandLogo({ className }: { className: string }) {
  return (
    <Image
      src="/zodiac-beauty-logo.png"
      alt="Zodiac International Distributors"
      width={590}
      height={170}
      priority
      className={`object-contain ${className}`}
    />
  );
}
