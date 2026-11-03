"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes,
  BookOpen,
  ChevronRight,
  FileImage,
  Gift,
  Layers,
  LayoutDashboard,
  Megaphone,
  Package,
  Pencil,
  Plus,
  Search,
  Save,
  ShoppingBag,
  Shield,
  Sparkles,
  Store,
  Tags,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';

import type { Product } from '@/lib/data';
import type { StoreBrand, StoreCategory, StoreCollection } from '@/lib/store';
import { DEFAULT_SITE_CONTENT, type AboutTeamMember } from '@/lib/site-content';
import { AdminCatalogManager } from '@/components/admin-catalog-manager';
import { AdminOrderManager } from '@/components/admin-order-manager';
import { SESSION_IDLE_TIMEOUT_SECONDS } from '@/lib/auth-constants';

type AdminDashboardProps = {
  user: { email: string; name: string; role: string };
};

type AdminSection = 'overview' | 'products' | 'inventory' | 'orders' | 'categories' | 'collections' | 'brands' | 'blog' | 'content' | 'users';

type ProductFormState = {
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  badge: string;
  image: string;
  shortDescription: string;
  description: string;
  ingredients: string;
  benefits: string;
  sizes: string;
  stock: number;
  placements: string[];
  customPlacements: string;
  collection: string;
  brand: string;
};

const IMAGE_PLACEHOLDER =
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80';

const STANDARD_PLACEMENTS = [
  { id: 'featured', label: 'Featured products', icon: Sparkles },
  { id: 'new_arrivals', label: 'New arrivals', icon: Package },
  { id: 'shop_by_category', label: 'Shop by category', icon: Store },
  { id: 'seasonal_offer', label: 'Seasonal offer', icon: Megaphone },
  { id: 'festive_season', label: 'Festive season', icon: Gift },
] as const;

const EMPTY_FORM: ProductFormState = {
  name: '',
  category: '',
  price: 0,
  rating: 4.8,
  reviews: 0,
  badge: 'New',
  image: IMAGE_PLACEHOLDER,
  shortDescription: '',
  description: '',
  ingredients: '',
  benefits: '',
  sizes: '30 ml',
  stock: 0,
  placements: [],
  customPlacements: '',
  collection: 'Glow Ritual',
  brand: '',
};

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'categories', label: 'Categories', icon: Tags },
  { id: 'collections', label: 'Collections', icon: Layers },
  { id: 'brands', label: 'Brands', icon: Store },
  { id: 'blog', label: 'Blog posts', icon: BookOpen },
  { id: 'content', label: 'Storefront content', icon: Store },
  { id: 'users', label: 'Admin accounts', icon: Shield },
];

const HERO_SLIDE_KEYS = [
  'hero_slide_1',
  'hero_slide_2',
  'hero_slide_3',
  'hero_slide_4',
] as const;
const ABOUT_SLIDE_KEYS = [
  'about_slide_1',
  'about_slide_2',
  'about_slide_3',
  'about_slide_4',
] as const;

function parseTeamMembers(value: string): AboutTeamMember[] {
  const parsed: unknown = JSON.parse(value || '[]');
  if (!Array.isArray(parsed) || !parsed.every((member) =>
    typeof member === 'object'
    && member !== null
    && typeof member.id === 'string'
    && typeof member.name === 'string'
    && typeof member.role === 'string'
    && typeof member.bio === 'string'
    && typeof member.image === 'string'
  )) {
    throw new Error('About page team data is invalid. Review the saved team members before editing.');
  }
  return parsed;
}

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function placementSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function placementLabel(id: string) {
  return id.slice('custom:'.length).split('-').map((word) => (
    word ? `${word[0]?.toUpperCase()}${word.slice(1)}` : ''
  )).join(' ');
}

function makeProductForm(product: Product): ProductFormState {
  const placements = product.placements ?? [
    ...(product.featured ? ['featured'] : []),
    ...(product.newArrival ? ['new_arrivals'] : []),
  ];

  return {
    name: product.name,
    category: product.category,
    price: product.price,
    originalPrice: product.originalPrice,
    rating: product.rating,
    reviews: product.reviews,
    badge: product.badge,
    image: product.image,
    shortDescription: product.shortDescription,
    description: product.description,
    ingredients: product.ingredients.join(', '),
    benefits: product.benefits.join(', '),
    sizes: product.sizes.join(', '),
    stock: product.stock,
    placements,
    customPlacements: placements
      .filter((placement) => placement.startsWith('custom:'))
      .map(placementLabel)
      .join(', '),
    collection: product.collection,
    brand: product.brand ?? '',
  };
}

export function AdminDashboard({ user }: AdminDashboardProps) {
  const lastActivityRef = useRef(Date.now());
  const lastRefreshRef = useRef(0);
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [brands, setBrands] = useState<StoreBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categoryUploading, setCategoryUploading] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);
  const [heroSlideUploading, setHeroSlideUploading] = useState<string | null>(null);
  const [teamPhotoUploading, setTeamPhotoUploading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryImage, setCategoryImage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [siteContent, setSiteContent] = useState(DEFAULT_SITE_CONTENT);
  const [teamMembers, setTeamMembers] = useState<AboutTeamMember[]>([]);

  useEffect(() => {
    const activityStorageKey = 'zodiac-admin-last-activity';
    const refreshInterval = 60 * 1000;
    let inactivityTimer: number;
    let redirecting = false;

    const expireSession = () => {
      if (redirecting) return;
      redirecting = true;
      void fetch('/api/auth/logout', { method: 'POST' })
        .catch((logoutError: unknown) => {
          console.error('Unable to clear an idle admin session:', logoutError);
        })
        .finally(() => {
          window.localStorage.removeItem(activityStorageKey);
          window.location.assign('/admin/login?reason=idle');
        });
    };

    const scheduleExpiry = () => {
      window.clearTimeout(inactivityTimer);
      const remaining = SESSION_IDLE_TIMEOUT_SECONDS * 1000 - (Date.now() - lastActivityRef.current);
      if (remaining <= 0) {
        expireSession();
        return;
      }
      inactivityTimer = window.setTimeout(scheduleExpiry, remaining);
    };

    const refreshSessionIfDue = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < refreshInterval) return;
      lastRefreshRef.current = now;
      void fetch('/api/auth/activity', { method: 'POST' }).then((response) => {
        if (response.status === 401) {
          expireSession();
          return;
        }
        if (!response.ok) {
          throw new Error('Unable to refresh your administrator session.');
        }
      }).catch((refreshError: unknown) => {
        console.error('Unable to refresh admin session:', refreshError);
        setError('Your session could not be refreshed. Save your work and sign in again if you are prompted.');
      });
    };

    const markActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      scheduleExpiry();
      if (now - lastRefreshRef.current >= refreshInterval) {
        window.localStorage.setItem(activityStorageKey, String(now));
        refreshSessionIfDue();
      } else if (now - Number(window.localStorage.getItem(activityStorageKey) || 0) >= 1000) {
        window.localStorage.setItem(activityStorageKey, String(now));
      }
    };

    const syncActivity = (event: StorageEvent) => {
      if (event.key !== activityStorageKey || !event.newValue) return;
      const activityAt = Number(event.newValue);
      if (Number.isFinite(activityAt) && activityAt <= Date.now() && Date.now() - activityAt < SESSION_IDLE_TIMEOUT_SECONDS * 1000) {
        lastActivityRef.current = activityAt;
        scheduleExpiry();
        refreshSessionIfDue();
      }
    };

    lastActivityRef.current = Date.now();
    window.localStorage.setItem(activityStorageKey, String(lastActivityRef.current));
    scheduleExpiry();
    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'wheel', 'touchstart'];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, markActivity, { passive: true });
    }
    window.addEventListener('storage', syncActivity);

    return () => {
      window.clearTimeout(inactivityTimer);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, markActivity);
      }
      window.removeEventListener('storage', syncActivity);
    };
  }, []);

  const loadProducts = async () => {
    const response = await fetch('/api/products');
    if (!response.ok) {
      throw new Error('Unable to load products.');
    }
    setProducts((await response.json()) as Product[]);
  };

  const loadCategories = async () => {
    const response = await fetch('/api/categories');
    if (!response.ok) {
      throw new Error('Unable to load categories.');
    }
    setCategories((await response.json()) as StoreCategory[]);
  };

  const loadCollectionsAndBrands = async () => {
    const [collectionsResponse, brandsResponse] = await Promise.all([
      fetch('/api/collections'),
      fetch('/api/brands'),
    ]);
    if (!collectionsResponse.ok || !brandsResponse.ok) {
      throw new Error('Unable to load collections and brands.');
    }
    const [collectionData, brandData] = await Promise.all([
      collectionsResponse.json() as Promise<StoreCollection[]>,
      brandsResponse.json() as Promise<StoreBrand[]>,
    ]);
    setCollections(collectionData);
    setBrands(brandData);
  };

  const loadSiteContent = async () => {
    const response = await fetch('/api/site-content');
    if (!response.ok) {
      throw new Error('Unable to load storefront content.');
    }
    const data = (await response.json()) as Record<string, string>;
    setSiteContent({ ...DEFAULT_SITE_CONTENT, ...data });
    setTeamMembers(parseTeamMembers(data.about_team_members ?? DEFAULT_SITE_CONTENT.about_team_members));
  };

  useEffect(() => {
    void Promise.all([loadProducts(), loadCategories(), loadCollectionsAndBrands(), loadSiteContent()])
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load admin data.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!form.category && categories.length > 0) {
      setForm((current) => ({ ...current, category: categories[0]?.name ?? '' }));
    }
  }, [categories, form.category]);

  const matchingProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        product.name,
        product.slug,
        product.category,
        product.collection,
        product.brand ?? '',
        product.badge,
        String(product.id),
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [products, query]);

  const inventoryProducts = useMemo(
    () => [...matchingProducts].sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name)),
    [matchingProducts],
  );

  const stats = useMemo(
    () => [
      { label: 'Products', value: String(products.length), icon: Package },
      { label: 'Units in stock', value: String(products.reduce((total, product) => total + product.stock, 0)), icon: ShoppingBag },
      { label: 'Low stock', value: String(products.filter((product) => product.stock > 0 && product.stock <= 5).length), icon: TrendingUp },
      { label: 'Categories', value: String(categories.length), icon: Tags },
    ],
    [categories.length, products],
  );

  const togglePlacement = (placement: string) => {
    setForm((current) => ({
      ...current,
      placements: current.placements.includes(placement)
        ? current.placements.filter((item) => item !== placement)
        : [...current.placements, placement],
    }));
  };

  const resetProductForm = () => {
    setEditingId(null);
    setShowProductForm(false);
    setForm({ ...EMPTY_FORM, category: categories[0]?.name ?? '' });
  };

  const startNewProduct = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, category: categories[0]?.name ?? '' });
    setShowProductForm(true);
    setError('');
    setNotice('');
  };

  const startProductEdit = (product: Product) => {
    setEditingId(product.id);
    setForm(makeProductForm(product));
    setShowProductForm(true);
    setActiveSection('products');
    setError('');
    setNotice('');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/uploads', { method: 'POST', body: formData });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        throw new Error(result.error || 'Unable to upload image.');
      }
      setForm((current) => ({ ...current, image: result.url ?? current.image }));
      setNotice('Image uploaded. Save the product to publish it.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleCategoryImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCategoryUploading(true);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/uploads', { method: 'POST', body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || 'Unable to upload category image.');
      setCategoryImage(result.url);
      setNotice('Category image uploaded. Save the category to publish it.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload category image.');
    } finally {
      setCategoryUploading(false);
    }
  };

  const handleHeroSlideUpload = async (
    key: typeof HERO_SLIDE_KEYS[number] | typeof ABOUT_SLIDE_KEYS[number],
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setHeroSlideUploading(key);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/uploads', { method: 'POST', body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || 'Unable to upload hero image.');
      setSiteContent((current) => ({ ...current, [key]: result.url ?? current[key] }));
      const slideIndex = [...HERO_SLIDE_KEYS, ...ABOUT_SLIDE_KEYS].indexOf(key) + 1;
      setNotice(`${key.startsWith('about_') ? 'About' : 'Homepage'} image ${slideIndex} uploaded. Save storefront content to publish it.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload hero image.');
    } finally {
      setHeroSlideUploading(null);
    }
  };

  const handleTeamMemberPhotoUpload = async (
    memberId: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setTeamPhotoUploading(memberId);
    setError('');
    setNotice('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/uploads', { method: 'POST', body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || 'Unable to upload team photo.');
      setTeamMembers((current) => current.map((member) =>
        member.id === memberId ? { ...member, image: result.url ?? member.image } : member,
      ));
      setNotice('Team photo uploaded. Save storefront content to publish it.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload team photo.');
    } finally {
      setTeamPhotoUploading(null);
    }
  };

  const updateTeamMember = (memberId: string, field: keyof Omit<AboutTeamMember, 'id'>, value: string) => {
    setTeamMembers((current) => current.map((member) =>
      member.id === memberId ? { ...member, [field]: value } : member,
    ));
  };

  const handleProductSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const customPlacements = parseList(form.customPlacements)
      .map(placementSlug)
      .filter(Boolean)
      .map((placement) => `custom:${placement}`);
    const placements = [...new Set([...form.placements, ...customPlacements])];
    const payload = {
      ...form,
      slug: placementSlug(form.name),
      originalPrice: form.originalPrice && Number(form.originalPrice) > 0 ? Number(form.originalPrice) : undefined,
      ingredients: parseList(form.ingredients),
      benefits: parseList(form.benefits),
      sizes: parseList(form.sizes),
      placements,
      featured: placements.includes('featured'),
      newArrival: placements.includes('new_arrivals'),
    };

    try {
      const response = await fetch(
        editingId ? `/api/products/${editingId}` : '/api/products',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'Unable to save product.');
      }
      await loadProducts();
      resetProductForm();
      setNotice('Product saved and storefront placements updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleProductDelete = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) {
      return;
    }

    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'Unable to delete product.');
      }
      if (editingId === product.id) {
        resetProductForm();
      }
      await loadProducts();
      setNotice('Product deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete product.');
    }
  };

  const handleCategorySubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategorySaving(true);
    setError('');
    setNotice('');

    const editingCategoryName = categories.find((category) => category.id === editingCategoryId)?.name;
    try {
      const response = await fetch(
        editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories',
        {
          method: editingCategoryId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: categoryName, image: categoryImage }),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'Unable to save category.');
      }
      const updatedCategory = (await response.json()) as StoreCategory;
      if (form.category === categoryName || form.category === editingCategoryName) {
        setForm((current) => ({ ...current, category: updatedCategory.name }));
      }
      setEditingCategoryId(null);
      setCategoryName('');
      setCategoryImage('');
      await Promise.all([loadCategories(), loadProducts()]);
      setNotice('Category saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save category.');
    } finally {
      setCategorySaving(false);
    }
  };

  const handleCategoryDelete = async (category: StoreCategory) => {
    if (category.productCount > 0) {
      setError('Move the category’s products before deleting it.');
      return;
    }
    if (!window.confirm(`Delete "${category.name}"?`)) {
      return;
    }

    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'Unable to delete category.');
      }
      await loadCategories();
      setNotice('Category deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete category.');
    }
  };

  const handleContentSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContentSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/site-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...siteContent, about_team_members: JSON.stringify(teamMembers) }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'Unable to save storefront content.');
      }
      setNotice('Storefront content saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save storefront content.');
    } finally {
      setContentSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Unable to sign out.');
      }
      window.localStorage.removeItem('zodiac-admin-last-activity');
      window.location.href = '/admin/login';
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Unable to sign out.');
    }
  };

  const sectionTitle = NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? 'Overview';
  const lowStockCount = products.filter((product) => product.stock > 0 && product.stock <= 5).length;
  const outOfStockCount = products.filter((product) => product.stock === 0).length;
  const handleSectionChange = (id: AdminSection) => {
    setActiveSection(id);
    setError('');
    setNotice('');
    if (id === 'products' || id === 'inventory') {
      void loadCollectionsAndBrands().catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : 'Unable to refresh collections and brands.');
      });
    }
  };

  return (
    <div className="container-shell py-8 md:py-12">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#b87580]">Zodiac Beauty</p>
          <h1 className="mt-1 font-serif text-4xl text-[#382a2a]">Store admin</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-[#382a2a]">{user.name}</p>
            <p className="text-xs text-[#8a6f6d]">{user.email}</p>
          </div>
          <button type="button" onClick={handleLogout} className="rounded-full border border-[#eadcdf] bg-white px-4 py-2 text-sm text-[#382a2a] hover:border-[#b87580]">Sign out</button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="h-fit rounded-[26px] border border-[#f0dfda] bg-white p-3 lg:sticky lg:top-6">
          <label className="sr-only" htmlFor="admin-section-select">Admin section</label>
          <select
            id="admin-section-select"
            value={activeSection}
            onChange={(event) => {
              const selected = NAV_ITEMS.find((item) => item.id === event.currentTarget.value)?.id;
              if (selected) {
                handleSectionChange(selected);
              }
            }}
            className="min-h-12 w-full rounded-2xl border border-[#eadcdf] bg-[#faf7f4] px-4 text-sm text-[#382a2a] outline-none focus:border-[#b87580] lg:hidden"
          >
            {NAV_ITEMS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </select>
          <nav aria-label="Admin sections" className="hidden gap-2 lg:flex lg:flex-col">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSectionChange(id)}
                aria-current={activeSection === id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition lg:w-full ${
                  activeSection === id
                    ? 'bg-[#382a2a] font-medium text-white'
                    : 'text-[#5d4c4b] hover:bg-[#faf2f0]'
                }`}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          <div className="mt-4 hidden border-t border-[#f0dfda] pt-4 lg:block">
            <a href="/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl px-4 py-3 text-sm text-[#8a6f6d] hover:bg-[#faf2f0]">
              View storefront <ChevronRight size={15} />
            </a>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#b87580]">Manage your store</p>
              <h2 className="mt-1 font-serif text-3xl text-[#382a2a]">{sectionTitle}</h2>
            </div>
            {(activeSection === 'products' || activeSection === 'inventory') ? (
              <label className="flex min-w-0 items-center gap-2 rounded-full border border-[#eadcdf] bg-white px-4 py-3 sm:w-80">
                <Search size={16} className="shrink-0 text-[#b87580]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, category, product ID..."
                  aria-label="Search products"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#382a2a] outline-none placeholder:text-[#a5908e]"
                />
                {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button> : null}
              </label>
            ) : null}
          </div>

          {error ? <p role="alert" className="mb-5 rounded-2xl bg-[#f9e8e5] px-4 py-3 text-sm text-[#8e3f45]">{error}</p> : null}
          {notice ? <p role="status" className="mb-5 rounded-2xl bg-[#e8f4eb] px-4 py-3 text-sm text-[#356a49]">{notice}</p> : null}
          {loading ? <p className="rounded-2xl border border-[#f0dfda] bg-white p-6 text-sm text-[#8a6f6d]">Loading store data...</p> : null}

          {!loading && activeSection === 'overview' ? (
            <section>
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {stats.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="section-card p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#8a6f6d]">{label}</p>
                        <p className="mt-3 text-3xl font-semibold text-[#382a2a]">{value}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4e1de] text-[#b87580]"><Icon size={18} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <div className="section-card p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-2xl text-[#382a2a]">Inventory attention</h3>
                      <p className="mt-1 text-sm text-[#8a6f6d]">Products to check before your next promotion.</p>
                    </div>
                    <button type="button" onClick={() => setActiveSection('inventory')} className="text-sm text-[#9b626d] underline underline-offset-2">View inventory</button>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#fbf3ef] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#8a6f6d]">Low stock</p><p className="mt-2 text-2xl font-semibold text-[#382a2a]">{lowStockCount}</p></div>
                    <div className="rounded-2xl bg-[#fbf3ef] p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#8a6f6d]">Out of stock</p><p className="mt-2 text-2xl font-semibold text-[#382a2a]">{outOfStockCount}</p></div>
                  </div>
                </div>
                <div className="section-card p-6">
                  <h3 className="font-serif text-2xl text-[#382a2a]">Quick actions</h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => { startNewProduct(); setActiveSection('products'); }} className="flex items-center gap-3 rounded-2xl border border-[#f0dfda] p-4 text-left text-sm text-[#382a2a] hover:bg-[#faf5f4]"><Plus size={17} className="text-[#b87580]" /> Add a product</button>
                    <button type="button" onClick={() => setActiveSection('categories')} className="flex items-center gap-3 rounded-2xl border border-[#f0dfda] p-4 text-left text-sm text-[#382a2a] hover:bg-[#faf5f4]"><Tags size={17} className="text-[#b87580]" /> Manage categories</button>
                    <button type="button" onClick={() => setActiveSection('content')} className="flex items-center gap-3 rounded-2xl border border-[#f0dfda] p-4 text-left text-sm text-[#382a2a] hover:bg-[#faf5f4]"><Megaphone size={17} className="text-[#b87580]" /> Edit storefront content</button>
                    <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-[#f0dfda] p-4 text-sm text-[#382a2a] hover:bg-[#faf5f4]"><Store size={17} className="text-[#b87580]" /> Preview storefront</a>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {!loading && activeSection === 'products' ? (
            <section className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#8a6f6d]">{matchingProducts.length} of {products.length} products</p>
                <button type="button" onClick={showProductForm ? resetProductForm : startNewProduct} className="inline-flex items-center gap-2 rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#b87580]">
                  {showProductForm ? <X size={16} /> : <Plus size={16} />}
                  {showProductForm ? 'Close editor' : 'Add product'}
                </button>
              </div>

              {showProductForm ? (
                <form onSubmit={handleProductSubmit} className="section-card space-y-6 p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.26em] text-[#b87580]">{editingId ? 'Edit catalog item' : 'New catalog item'}</p>
                      <h3 className="mt-1 font-serif text-2xl text-[#382a2a]">{editingId ? form.name : 'Product details'}</h3>
                    </div>
                    <button type="button" onClick={resetProductForm} aria-label="Close product editor" className="rounded-full border border-[#eadcdf] p-2 text-[#8a6f6d]"><X size={17} /></button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 md:col-span-2"><span className="text-sm text-[#382a2a]">Product name</span><input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={180} className="admin-input" required /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Category</span><select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="admin-input" required>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Collection</span><select value={form.collection} onChange={(event) => setForm((current) => ({ ...current, collection: event.target.value }))} className="admin-input" required>{!collections.some((collection) => collection.name === form.collection) ? <option value={form.collection}>{form.collection} (legacy)</option> : null}{collections.map((collection) => <option key={collection.id} value={collection.name}>{collection.name}</option>)}</select></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Brand</span><select value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} className="admin-input"><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.name}>{brand.name}</option>)}</select></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Price</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) }))} className="admin-input" required /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Original price</span><input type="number" min="0" step="0.01" value={form.originalPrice ?? ''} onChange={(event) => setForm((current) => ({ ...current, originalPrice: event.target.value === '' ? undefined : Number(event.target.value) }))} className="admin-input" /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Stock quantity</span><input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm((current) => ({ ...current, stock: Number(event.target.value) }))} className="admin-input" required /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Product badge</span><input value={form.badge} onChange={(event) => setForm((current) => ({ ...current, badge: event.target.value }))} maxLength={80} className="admin-input" /></label>

                    <div className="space-y-3 md:col-span-2">
                      <span className="text-sm text-[#382a2a]">Product image</span>
                      <div className="flex flex-col gap-4 rounded-2xl border border-[#f0dfda] bg-[#fdf9f8] p-4 sm:flex-row sm:items-center">
                        <img src={form.image || IMAGE_PLACEHOLDER} alt="Product image preview" className="h-28 w-28 rounded-xl bg-white object-cover" />
                        <div className="min-w-0 flex-1 space-y-3">
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4 py-3 text-sm text-[#382a2a] hover:border-[#b87580] sm:w-fit">
                            <FileImage size={16} className="text-[#b87580]" />
                            {uploading ? 'Uploading image...' : 'Upload image from device'}
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => void handleImageUpload(event)} className="sr-only" />
                          </label>
                          <p className="text-xs text-[#8a6f6d]">JPEG, PNG, WebP or GIF · up to 5 MB</p>
                          <label className="block space-y-1"><span className="text-xs text-[#8a6f6d]">Or paste an image URL or local upload path</span><input type="text" value={form.image} onChange={(event) => setForm((current) => ({ ...current, image: event.target.value }))} className="admin-input" required /></label>
                        </div>
                      </div>
                    </div>

                    <label className="space-y-2 md:col-span-2"><span className="text-sm text-[#382a2a]">Short description</span><input value={form.shortDescription} onChange={(event) => setForm((current) => ({ ...current, shortDescription: event.target.value }))} maxLength={2000} className="admin-input" /></label>
                    <label className="space-y-2 md:col-span-2"><span className="text-sm text-[#382a2a]">Product description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={10000} className="admin-input min-h-28" /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Ingredients (comma-separated)</span><textarea value={form.ingredients} onChange={(event) => setForm((current) => ({ ...current, ingredients: event.target.value }))} className="admin-input min-h-24" /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Benefits (comma-separated)</span><textarea value={form.benefits} onChange={(event) => setForm((current) => ({ ...current, benefits: event.target.value }))} className="admin-input min-h-24" /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Available sizes (comma-separated)</span><input value={form.sizes} onChange={(event) => setForm((current) => ({ ...current, sizes: event.target.value }))} className="admin-input" /></label>
                    <label className="space-y-2"><span className="text-sm text-[#382a2a]">Rating</span><input type="number" min="1" max="5" step="0.1" value={form.rating} onChange={(event) => setForm((current) => ({ ...current, rating: Number(event.target.value) }))} className="admin-input" /></label>

                    <fieldset className="space-y-3 md:col-span-2">
                      <legend className="text-sm font-medium text-[#382a2a]">Where should this product appear?</legend>
                      <p className="text-xs text-[#8a6f6d]">Select storefront sections manually. Best sellers and customer favorites are ranked automatically.</p>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {STANDARD_PLACEMENTS.map(({ id, label, icon: Icon }) => (
                          <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${form.placements.includes(id) ? 'border-[#bd8189] bg-[#fbf1f0] text-[#382a2a]' : 'border-[#f0dfda] bg-white text-[#665351]'}`}>
                            <input type="checkbox" checked={form.placements.includes(id)} onChange={() => togglePlacement(id)} className="h-4 w-4 accent-[#9b626d]" />
                            <Icon size={16} className="text-[#b87580]" />
                            {label}
                          </label>
                        ))}
                      </div>
                      <label className="block space-y-2 pt-2">
                        <span className="text-sm text-[#382a2a]">Custom storefront sections</span>
                        <input value={form.customPlacements} onChange={(event) => setForm((current) => ({ ...current, customPlacements: event.target.value }))} className="admin-input" placeholder="e.g. Winter Edit, Mother's Day" />
                        <span className="block text-xs text-[#8a6f6d]">Separate section names with commas. Products appear in matching sections on the homepage.</span>
                      </label>
                    </fieldset>
                  </div>

                  <div className="flex flex-wrap gap-3 border-t border-[#f0dfda] pt-5">
                    <button type="submit" disabled={saving || uploading || categories.length === 0} className="inline-flex items-center gap-2 rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#b87580] disabled:cursor-not-allowed disabled:opacity-60"><Save size={15} />{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create product'}</button>
                    <button type="button" onClick={resetProductForm} className="rounded-full border border-[#e9d8d0] bg-white px-5 py-3 text-sm text-[#382a2a]">Cancel</button>
                    {categories.length === 0 ? <p className="self-center text-xs text-[#8a6f6d]">Create a category before adding products.</p> : null}
                  </div>
                </form>
              ) : null}

              <div className="overflow-hidden rounded-[24px] border border-[#f0dfda] bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_52px_64px] gap-2 border-b border-[#f0dfda] bg-[#fcf8f7] px-2.5 py-3 text-[9px] uppercase tracking-[0.12em] text-[#8a6f6d] sm:grid-cols-[minmax(0,1fr)_100px_90px_130px] sm:gap-3 sm:px-4 sm:text-[10px] sm:tracking-[0.18em]">
                  <span>Product</span><span className="hidden sm:inline">Category</span><span>Stock</span><span className="text-right">Actions</span>
                </div>
                {matchingProducts.map((product) => (
                  <div key={product.id} className="grid grid-cols-[minmax(0,1fr)_52px_64px] items-center gap-2 border-b border-[#f5e9e6] px-2.5 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_100px_90px_130px] sm:gap-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover sm:h-12 sm:w-12" />
                      <div className="min-w-0"><p className="truncate text-sm font-medium text-[#382a2a]">{product.name}</p><p className="truncate text-xs text-[#8a6f6d]">${product.price.toFixed(2)} · {product.placements?.length ?? 0} placements</p></div>
                    </div>
                    <span className="hidden truncate text-xs text-[#5d4c4b] sm:inline">{product.category}</span>
                    <span className={`text-xs ${product.stock <= 5 ? 'font-medium text-[#a64f52]' : 'text-[#5d4c4b]'}`}>{product.stock}</span>
                    <div className="flex justify-end gap-1 sm:gap-2">
                      <button type="button" onClick={() => startProductEdit(product)} aria-label={`Edit ${product.name}`} className="rounded-full border border-[#eadcdf] p-1.5 text-[#72575a] hover:border-[#b87580] sm:p-2"><Pencil size={14} /></button>
                      <button type="button" onClick={() => void handleProductDelete(product)} aria-label={`Delete ${product.name}`} className="rounded-full border border-[#eadcdf] p-1.5 text-[#9a5858] hover:border-[#b87580] sm:p-2"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                {matchingProducts.length === 0 ? <p className="p-8 text-center text-sm text-[#8a6f6d]">{query ? 'No products match your search.' : 'No products yet. Add your first product.'}</p> : null}
              </div>
            </section>
          ) : null}

          {!loading && activeSection === 'inventory' ? (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#f0dfda] bg-white p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#8a6f6d]">Total units</p><p className="mt-2 text-2xl font-semibold text-[#382a2a]">{products.reduce((total, product) => total + product.stock, 0)}</p></div>
                <div className="rounded-2xl border border-[#f0dfda] bg-white p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#8a6f6d]">Low stock (1–5)</p><p className="mt-2 text-2xl font-semibold text-[#a06448]">{lowStockCount}</p></div>
                <div className="rounded-2xl border border-[#f0dfda] bg-white p-4"><p className="text-xs uppercase tracking-[0.18em] text-[#8a6f6d]">Out of stock</p><p className="mt-2 text-2xl font-semibold text-[#a64f52]">{outOfStockCount}</p></div>
              </div>
              <div className="overflow-hidden rounded-[24px] border border-[#f0dfda] bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_52px_64px_64px] gap-1.5 border-b border-[#f0dfda] bg-[#fcf8f7] px-2.5 py-3 text-[8px] uppercase tracking-[0.1em] text-[#8a6f6d] sm:grid-cols-[minmax(0,1fr)_120px_100px_120px] sm:gap-3 sm:px-4 sm:text-[10px] sm:tracking-[0.18em]"><span>Product</span><span className="hidden sm:inline">Category</span><span>Qty</span><span className="text-right">Action</span></div>
                {inventoryProducts.map((product) => (
                  <div key={product.id} className="grid grid-cols-[minmax(0,1fr)_52px_64px_64px] items-center gap-1.5 border-b border-[#f5e9e6] px-2.5 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_120px_100px_120px] sm:gap-3 sm:px-4">
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3"><img src={product.image} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover sm:h-12 sm:w-12" /><div className="min-w-0"><p className="truncate text-sm font-medium text-[#382a2a]">{product.name}</p><p className="text-xs text-[#8a6f6d]">SKU #{product.id}</p></div></div>
                    <span className="hidden truncate text-xs text-[#5d4c4b] sm:inline">{product.category}</span>
                    <span className={`text-xs font-semibold sm:text-sm ${product.stock === 0 ? 'text-[#a64f52]' : product.stock <= 5 ? 'text-[#a06448]' : 'text-[#382a2a]'}`}>{product.stock} <span className="hidden sm:inline">{product.stock === 1 ? 'unit' : 'units'}</span></span>
                    <div className="text-right"><button type="button" onClick={() => startProductEdit(product)} className="rounded-full border border-[#eadcdf] px-2 py-2 text-[10px] text-[#72575a] hover:border-[#b87580] sm:px-3 sm:text-xs"><span className="sm:hidden">Edit</span><span className="hidden sm:inline">Update stock</span></button></div>
                  </div>
                ))}
                {inventoryProducts.length === 0 ? <p className="p-8 text-center text-sm text-[#8a6f6d]">No inventory items match your search.</p> : null}
              </div>
            </section>
          ) : null}

          {!loading && activeSection === 'categories' ? (
            <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <form onSubmit={handleCategorySubmit} className="section-card h-fit space-y-4 p-6">
                <div><p className="text-[10px] uppercase tracking-[0.24em] text-[#b87580]">Catalog</p><h3 className="mt-1 font-serif text-2xl text-[#382a2a]">{editingCategoryId ? 'Edit category' : 'Add category'}</h3></div>
                <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Category name</span><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={60} className="admin-input" placeholder="e.g. Bath & Body" required /></label>
                <div className="space-y-3">
                  <span className="text-sm text-[#382a2a]">Category image</span>
                  {categoryImage ? <img src={categoryImage} alt="Category image preview" className="h-36 w-full rounded-2xl object-cover" /> : null}
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4 py-3 text-sm text-[#382a2a] hover:border-[#b87580]">
                    <FileImage size={16} className="text-[#b87580]" />{categoryUploading ? 'Uploading image...' : 'Upload image from device'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={categoryUploading} onChange={(event) => void handleCategoryImageUpload(event)} className="sr-only" />
                  </label>
                  <input type="text" value={categoryImage} onChange={(event) => setCategoryImage(event.target.value)} maxLength={2048} className="admin-input" placeholder="Or paste an image URL or upload path" required />
                  <p className="text-xs text-[#8a6f6d]">JPEG, PNG, WebP or GIF · up to 5 MB</p>
                </div>
                <div className="flex gap-3"><button type="submit" disabled={categorySaving || categoryUploading} className="rounded-full bg-[#382a2a] px-5 py-3 text-sm text-white hover:bg-[#b87580] disabled:opacity-60">{categorySaving ? 'Saving...' : categoryUploading ? 'Uploading image...' : editingCategoryId ? 'Save category' : 'Add category'}</button>{editingCategoryId ? <button type="button" onClick={() => { setEditingCategoryId(null); setCategoryName(''); setCategoryImage(''); }} className="rounded-full border border-[#e9d8d0] bg-white px-5 py-3 text-sm">Cancel</button> : null}</div>
              </form>
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((category) => (
                  <article key={category.id} className="flex items-center gap-3 rounded-[20px] border border-[#f0dfda] bg-white p-3">
                    <img src={category.image} alt="" className="h-16 w-16 rounded-[14px] object-cover" />
                    <div className="min-w-0 flex-1"><p className="truncate font-medium text-[#382a2a]">{category.name}</p><p className="text-xs text-[#8a6f6d]">{category.productCount} products</p><div className="mt-2 flex gap-3"><button type="button" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); setCategoryImage(category.image); }} className="text-xs text-[#8e5963] underline underline-offset-2">Edit</button><button type="button" onClick={() => void handleCategoryDelete(category)} className="text-xs text-[#8e5963] underline underline-offset-2">Delete</button></div></div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {!loading && activeSection === 'content' ? (
            <form onSubmit={handleContentSave} className="section-card space-y-4 p-6">
              <div className="mb-2"><p className="text-[10px] uppercase tracking-[0.24em] text-[#b87580]">CMS</p><h3 className="mt-1 font-serif text-2xl text-[#382a2a]">Homepage content</h3><p className="mt-2 text-sm text-[#8a6f6d]">Update the copy and four rotating hero images displayed on your storefront.</p></div>
              <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Hero badge</span><input value={siteContent.hero_badge} onChange={(event) => setSiteContent((current) => ({ ...current, hero_badge: event.target.value }))} className="admin-input" /></label>
              <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Hero title</span><input value={siteContent.hero_title} onChange={(event) => setSiteContent((current) => ({ ...current, hero_title: event.target.value }))} className="admin-input" /></label>
              <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Hero subtitle</span><textarea value={siteContent.hero_subtitle} onChange={(event) => setSiteContent((current) => ({ ...current, hero_subtitle: event.target.value }))} className="admin-input min-h-24" /></label>
              <section className="space-y-4 rounded-2xl border border-[#f0dfda] p-4">
                <div>
                  <h4 className="text-sm font-medium text-[#382a2a]">Homepage hero slider</h4>
                  <p className="mt-1 text-xs text-[#8a6f6d]">Upload up to four images from your device or paste image URLs. Slides rotate automatically with zoom and slide transitions.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {HERO_SLIDE_KEYS.map((key, index) => (
                    <div key={key} className="space-y-3 rounded-xl bg-[#faf7f4] p-3">
                      <p className="text-sm font-medium text-[#382a2a]">Slide {index + 1}</p>
                      {siteContent[key] ? <img src={siteContent[key]} alt={`Homepage hero slide ${index + 1} preview`} className="h-36 w-full rounded-xl object-cover" /> : null}
                      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4 py-2 text-sm text-[#382a2a] hover:border-[#b87580]">
                        <FileImage size={16} className="text-[#b87580]" />{heroSlideUploading === key ? 'Uploading image...' : 'Upload image from device'}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={heroSlideUploading !== null} onChange={(event) => void handleHeroSlideUpload(key, event)} className="sr-only" />
                      </label>
                      <input type="text" value={siteContent[key]} onChange={(event) => setSiteContent((current) => ({ ...current, [key]: event.target.value }))} maxLength={2048} className="admin-input" aria-label={`Hero slide ${index + 1} image URL`} placeholder="Image URL or uploaded image path" required />
                    </div>
                  ))}
                </div>
              </section>
              <section className="space-y-4 rounded-2xl border border-[#f0dfda] p-4">
                <div>
                  <h4 className="text-sm font-medium text-[#382a2a]">About Us page</h4>
                  <p className="mt-1 text-xs text-[#8a6f6d]">Edit the story, image slider, and team members shown to customers.</p>
                </div>
                <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Section label</span><input value={siteContent.about_eyebrow} onChange={(event) => setSiteContent((current) => ({ ...current, about_eyebrow: event.target.value }))} maxLength={100} className="admin-input" /></label>
                <label className="block space-y-2"><span className="text-sm text-[#382a2a]">About heading</span><input value={siteContent.about_title} onChange={(event) => setSiteContent((current) => ({ ...current, about_title: event.target.value }))} maxLength={180} className="admin-input" /></label>
                <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Introduction</span><textarea value={siteContent.about_intro} onChange={(event) => setSiteContent((current) => ({ ...current, about_intro: event.target.value }))} maxLength={2000} className="admin-input min-h-24" /></label>
                <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Our story</span><textarea value={siteContent.about_story} onChange={(event) => setSiteContent((current) => ({ ...current, about_story: event.target.value }))} maxLength={6000} className="admin-input min-h-32" /></label>
                <div className="grid gap-4 sm:grid-cols-2">
                  {ABOUT_SLIDE_KEYS.map((key, index) => (
                    <div key={key} className="space-y-3 rounded-xl bg-[#faf7f4] p-3">
                      <p className="text-sm font-medium text-[#382a2a]">About image {index + 1}</p>
                      {siteContent[key] ? <img src={siteContent[key]} alt={`About page image ${index + 1} preview`} className="h-36 w-full rounded-xl object-cover" /> : null}
                      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4 py-2 text-sm text-[#382a2a] hover:border-[#b87580]">
                        <FileImage size={16} className="text-[#b87580]" />{heroSlideUploading === key ? 'Uploading image...' : 'Upload image from device'}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={heroSlideUploading !== null} onChange={(event) => void handleHeroSlideUpload(key, event)} className="sr-only" />
                      </label>
                      <input type="text" value={siteContent[key]} onChange={(event) => setSiteContent((current) => ({ ...current, [key]: event.target.value }))} maxLength={2048} className="admin-input" aria-label={`About image ${index + 1} URL`} placeholder="Image URL or uploaded image path" required />
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h5 className="text-sm font-medium text-[#382a2a]">Team members</h5><p className="mt-1 text-xs text-[#8a6f6d]">Add a name, role, short bio, and optional portrait for each person.</p></div>
                    <button
                      type="button"
                      onClick={() => setTeamMembers((current) => [...current, {
                        id: crypto.randomUUID(), name: '', role: '', bio: '', image: '',
                      }])}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4 text-sm text-[#382a2a] hover:border-[#b87580]"
                    >
                      <Plus size={15} /> Add team member
                    </button>
                  </div>
                  {teamMembers.length === 0 ? <p className="rounded-xl bg-[#faf7f4] p-4 text-sm text-[#8a6f6d]">No team members added yet.</p> : null}
                  {teamMembers.map((member, index) => (
                    <div key={member.id} className="grid gap-4 rounded-xl border border-[#f0dfda] p-4 sm:grid-cols-[120px_1fr]">
                      <div className="space-y-2">
                        {member.image ? <img src={member.image} alt={`${member.name || 'Team member'} portrait preview`} className="h-28 w-full rounded-xl object-cover" /> : <div className="flex h-28 items-center justify-center rounded-xl bg-[#f7efee] text-xs text-[#8a6f6d]">No photo</div>}
                        <label className="flex min-h-10 cursor-pointer items-center justify-center rounded-full border border-[#e9d8d0] bg-white px-3 text-xs text-[#382a2a] hover:border-[#b87580]">
                          {teamPhotoUploading === member.id ? 'Uploading...' : 'Upload portrait'}
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={teamPhotoUploading !== null} onChange={(event) => void handleTeamMemberPhotoUpload(member.id, event)} className="sr-only" />
                        </label>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[#382a2a]">Team member {index + 1}</p>
                          <button type="button" onClick={() => setTeamMembers((current) => current.filter((item) => item.id !== member.id))} className="text-xs text-[#9b626d] underline underline-offset-2">Remove</button>
                        </div>
                        <label className="block space-y-1"><span className="text-xs text-[#5d4c4b]">Name</span><input value={member.name} onChange={(event) => updateTeamMember(member.id, 'name', event.target.value)} maxLength={100} className="admin-input" /></label>
                        <label className="block space-y-1"><span className="text-xs text-[#5d4c4b]">Role / title</span><input value={member.role} onChange={(event) => updateTeamMember(member.id, 'role', event.target.value)} maxLength={120} className="admin-input" /></label>
                        <label className="block space-y-1"><span className="text-xs text-[#5d4c4b]">Short bio</span><textarea value={member.bio} onChange={(event) => updateTeamMember(member.id, 'bio', event.target.value)} maxLength={1000} className="admin-input min-h-20" /></label>
                        <label className="block space-y-1"><span className="text-xs text-[#5d4c4b]">Portrait URL (optional)</span><input value={member.image} onChange={(event) => updateTeamMember(member.id, 'image', event.target.value)} maxLength={2048} className="admin-input" /></label>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="space-y-4 rounded-2xl border border-[#f0dfda] p-4">
                <div>
                  <h4 className="text-sm font-medium text-[#382a2a]">Contact details and location</h4>
                  <p className="mt-1 text-xs text-[#8a6f6d]">These details appear on the About Us and Contact pages.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Phone number</span><input type="tel" value={siteContent.contact_phone} onChange={(event) => setSiteContent((current) => ({ ...current, contact_phone: event.target.value }))} maxLength={40} className="admin-input" /></label>
                  <label className="block space-y-2"><span className="text-sm text-[#382a2a]">WhatsApp number (international digits)</span><input type="tel" value={siteContent.contact_whatsapp} onChange={(event) => setSiteContent((current) => ({ ...current, contact_whatsapp: event.target.value }))} maxLength={40} className="admin-input" /></label>
                  <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Contact email</span><input type="email" value={siteContent.contact_email} onChange={(event) => setSiteContent((current) => ({ ...current, contact_email: event.target.value }))} maxLength={254} className="admin-input" /></label>
                  <label className="block space-y-2"><span className="text-sm text-[#382a2a]">City / location</span><input value={siteContent.contact_location} onChange={(event) => setSiteContent((current) => ({ ...current, contact_location: event.target.value }))} maxLength={180} className="admin-input" /></label>
                  <label className="block space-y-2 sm:col-span-2"><span className="text-sm text-[#382a2a]">Street address or directions (optional)</span><input value={siteContent.contact_address} onChange={(event) => setSiteContent((current) => ({ ...current, contact_address: event.target.value }))} maxLength={300} className="admin-input" /></label>
                  <label className="block space-y-2 sm:col-span-2"><span className="text-sm text-[#382a2a]">Opening hours</span><input value={siteContent.contact_hours} onChange={(event) => setSiteContent((current) => ({ ...current, contact_hours: event.target.value }))} maxLength={180} className="admin-input" /></label>
                  <label className="block space-y-2 sm:col-span-2"><span className="text-sm text-[#382a2a]">Contact page introduction</span><textarea value={siteContent.contact_message} onChange={(event) => setSiteContent((current) => ({ ...current, contact_message: event.target.value }))} maxLength={1000} className="admin-input min-h-20" /></label>
                </div>
              </section>
              <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Seasonal offer title</span><input value={siteContent.sale_title} onChange={(event) => setSiteContent((current) => ({ ...current, sale_title: event.target.value }))} className="admin-input" /></label>
              <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Seasonal offer description</span><textarea value={siteContent.sale_description} onChange={(event) => setSiteContent((current) => ({ ...current, sale_description: event.target.value }))} className="admin-input min-h-24" /></label>
              <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Brand story</span><textarea value={siteContent.brand_story} onChange={(event) => setSiteContent((current) => ({ ...current, brand_story: event.target.value }))} className="admin-input min-h-28" /></label>
              <button type="submit" disabled={contentSaving || heroSlideUploading !== null || teamPhotoUploading !== null} className="inline-flex items-center gap-2 rounded-full bg-[#382a2a] px-5 py-3 text-sm font-medium text-white hover:bg-[#b87580] disabled:opacity-60"><Save size={15} />{contentSaving ? 'Saving...' : 'Save storefront content'}</button>
            </form>
          ) : null}

          {!loading && (activeSection === 'collections' || activeSection === 'brands' || activeSection === 'blog' || activeSection === 'users') ? (
            <AdminCatalogManager section={activeSection} />
          ) : null}
          {activeSection === 'orders' ? <AdminOrderManager /> : null}
        </main>
      </div>
    </div>
  );
}
