import Image from 'next/image';
import Link from 'next/link';

import { readBlogPosts } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function BlogPage() {
  const posts = await readBlogPosts();
  return (
    <div className="container-shell py-10 sm:py-16">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#b87580]">Journal</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-[#382a2a] sm:text-5xl">Beauty notes &amp; inspiration</h1>
      </div>
      {posts.length === 0 ? (
        <p className="section-card p-8 text-sm text-[#8a6f6d]">New beauty notes are coming soon.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <article key={post.id} className="section-card overflow-hidden p-3">
              <Link href={`/blog/${post.slug}`} className="block">
                <Image src={post.image} alt={post.title} width={1200} height={900} unoptimized className="h-60 w-full rounded-[20px] object-cover" />
                <div className="px-2 pb-3 pt-5">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[#b87580]">{post.category}</p>
                  <h2 className="mt-3 font-serif text-3xl text-[#382a2a]">{post.title}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#665351]">{post.excerpt}</p>
                  <span className="mt-4 inline-block text-sm text-[#9b626d] underline underline-offset-4">Read article</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
