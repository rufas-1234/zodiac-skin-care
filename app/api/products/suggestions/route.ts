import { NextResponse } from 'next/server';

import { readProducts } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim().toLocaleLowerCase() ?? '';
  if (query.length < 2 || query.length > 80) {
    return NextResponse.json({ suggestions: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const products = await readProducts();
    const searchTerms = query.split(/\s+/).filter(Boolean);
    const suggestions = products
      .filter((product) => {
        const searchableValues = [
        product.name,
        product.category,
        product.brand,
        product.collection,
        product.shortDescription,
        ...product.ingredients,
        product.price.toString(),
        product.originalPrice?.toString(),
        ].filter((value): value is string => Boolean(value)).map((value) => value.toLocaleLowerCase());
        return searchTerms.every((term) => searchableValues.some((value) => value.includes(term)));
      })
      .sort((left, right) => {
        const leftStartsWith = left.name.toLocaleLowerCase().startsWith(query);
        const rightStartsWith = right.name.toLocaleLowerCase().startsWith(query);
        if (leftStartsWith !== rightStartsWith) return leftStartsWith ? -1 : 1;
        const leftMatchesFirstTerm = left.name.toLocaleLowerCase().startsWith(searchTerms[0]);
        const rightMatchesFirstTerm = right.name.toLocaleLowerCase().startsWith(searchTerms[0]);
        if (leftMatchesFirstTerm !== rightMatchesFirstTerm) return leftMatchesFirstTerm ? -1 : 1;
        return Number(right.featured) - Number(left.featured);
      })
      .slice(0, 6)
      .map(({ slug, name, category, price, image, brand }) => ({
        slug, name, category, price, image, brand,
      }));

    return NextResponse.json({ suggestions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to load product suggestions:', error);
    return NextResponse.json({ error: 'Unable to load product suggestions.' }, { status: 500 });
  }
}
