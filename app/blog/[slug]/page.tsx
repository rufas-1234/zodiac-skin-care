import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { readBlogPostBySlug } from '@/lib/store';

export const dynamic = 'force-dynamic';
type PageProps = { params: Promise<{ slug: string }> };

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await readBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <article className="container-shell max-w-4xl py-10 sm:py-16">
      <Link href="/blog" className="inline-flex min-h-11 items-center text-sm text-[#9b626d] underline underline-offset-4">Back to journal</Link>
      <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-[#b87580] sm:mt-8">{post.category}</p>
      <h1 className="mt-3 font-serif text-3xl leading-tight text-[#382a2a] sm:text-4xl md:text-6xl">{post.title}</h1>
      <p className="mt-4 text-sm text-[#8a6f6d]">By {post.author}</p>
      <Image src={post.image} alt={post.title} width={1400} height={900} unoptimized className="mt-6 max-h-[560px] w-full rounded-[20px] object-cover sm:mt-8 sm:rounded-[28px]" />
      <p className="mt-6 text-base leading-7 text-[#5d4c4b] sm:mt-8 sm:text-lg sm:leading-8">{post.excerpt}</p>
      <div className="mt-6 space-y-5 text-base leading-7 text-[#5d4c4b] sm:leading-8">
        {post.content.split(/\r?\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => (
          <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
        ))}
      </div>
    </article>
  );
}
