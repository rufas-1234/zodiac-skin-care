import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-shell flex min-h-[60vh] items-center justify-center py-12 sm:py-20">
      <div className="section-card max-w-xl p-6 text-center sm:p-10">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#b87580]">404</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Page not found</h1>
        <p className="mt-4 text-base text-[#5d4c4b]">The product or page you were looking for is no longer available.</p>
        <Link href="/shop" className="primary-button mt-8">
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
