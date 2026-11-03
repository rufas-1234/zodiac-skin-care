"use client";

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, FileImage, Layers, Pencil, Plus, Save, Shield, Tags, Trash2 } from 'lucide-react';

import type { BlogPost, StoreBrand, StoreCollection } from '@/lib/store';

type CatalogSection = 'collections' | 'brands' | 'blog' | 'users';
type AdminUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  emailTwoFactorEnabled?: boolean;
};
type ResourceForm = { name: string; description: string; image: string };
type BlogForm = {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  author: string;
  published: boolean;
};

const EMPTY_RESOURCE: ResourceForm = { name: '', description: '', image: '' };
const EMPTY_BLOG: BlogForm = {
  title: '',
  excerpt: '',
  content: '',
  category: 'Skincare',
  image: '',
  author: '',
  published: false,
};

async function responseError(response: Response, fallback: string) {
  const result = await response.json() as { error?: string };
  return new Error(result.error || fallback);
}

export function AdminCatalogManager({ section }: { section: CatalogSection }) {
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [brands, setBrands] = useState<StoreBrand[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [resourceForm, setResourceForm] = useState<ResourceForm>(EMPTY_RESOURCE);
  const [blogForm, setBlogForm] = useState<BlogForm>(EMPTY_BLOG);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: '',
    email: '',
    password: '',
    emailTwoFactorEnabled: false,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSection = useCallback(async () => {
    const endpoint = section === 'collections' ? '/api/collections'
      : section === 'brands' ? '/api/brands'
        : section === 'blog' ? '/api/blog?admin=1'
          : '/api/admin/users';
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) throw await responseError(response, 'Unable to load this section.');
    const data = await response.json();
    if (section === 'collections') setCollections(data as StoreCollection[]);
    if (section === 'brands') setBrands(data as StoreBrand[]);
    if (section === 'blog') setPosts(data as BlogPost[]);
    if (section === 'users') setUsers(data as AdminUser[]);
  }, [section]);

  useEffect(() => {
    setError('');
    setNotice('');
    void loadSection().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this section.');
    });
  }, [loadSection]);

  const resetForm = () => {
    setEditingId(null);
    setResourceForm(EMPTY_RESOURCE);
    setBlogForm(EMPTY_BLOG);
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/uploads', { method: 'POST', body: formData });
      if (!response.ok) throw await responseError(response, 'Unable to upload image.');
      const result = await response.json() as { url?: string };
      if (!result.url) throw new Error('Image upload did not return a URL.');
      const url = result.url;
      if (section === 'blog') setBlogForm((current) => ({ ...current, image: url }));
      else setResourceForm((current) => ({ ...current, image: url }));
      setNotice('Image uploaded. Save the changes to publish it.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const submitResource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const endpoint = section === 'collections' ? '/api/collections' : '/api/brands';
      const response = await fetch(editingId ? `${endpoint}/${editingId}` : endpoint, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resourceForm),
      });
      if (!response.ok) throw await responseError(response, 'Unable to save this item.');
      await loadSection();
      resetForm();
      setNotice(`${section === 'collections' ? 'Collection' : 'Brand'} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this item.');
    } finally {
      setBusy(false);
    }
  };

  const deleteResource = async (resource: StoreCollection | StoreBrand) => {
    if (!window.confirm(`Delete "${resource.name}"?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/${section}/${resource.id}`, { method: 'DELETE' });
      if (!response.ok) throw await responseError(response, 'Unable to delete this item.');
      await loadSection();
      setNotice(`${section === 'collections' ? 'Collection' : 'Brand'} deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this item.');
    }
  };

  const submitBlog = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(editingId ? `/api/blog/${editingId}` : '/api/blog', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blogForm),
      });
      if (!response.ok) throw await responseError(response, 'Unable to save blog post.');
      await loadSection();
      resetForm();
      setNotice('Blog post saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save blog post.');
    } finally {
      setBusy(false);
    }
  };

  const deleteBlogPost = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/blog/${post.id}`, { method: 'DELETE' });
      if (!response.ok) throw await responseError(response, 'Unable to delete blog post.');
      await loadSection();
      setNotice('Blog post deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete blog post.');
    }
  };

  const submitAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountForm),
      });
      if (!response.ok) throw await responseError(response, 'Unable to create admin account.');
      setAccountForm({ name: '', email: '', password: '', emailTwoFactorEnabled: false });
      await loadSection();
      setNotice('Administrator account created.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create admin account.');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async (user: AdminUser) => {
    if (!window.confirm(`Delete administrator account for ${user.email}?`)) return;
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (!response.ok) throw await responseError(response, 'Unable to delete admin account.');
      await loadSection();
      setNotice('Administrator account deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete admin account.');
    }
  };

  const title = section === 'collections' ? 'Collections'
    : section === 'brands' ? 'Brands'
      : section === 'blog' ? 'Blog CMS' : 'Admin accounts';
  const Icon = section === 'collections' ? Layers
    : section === 'brands' ? Tags
      : section === 'blog' ? BookOpen : Shield;
  const resourceList = section === 'collections' ? collections : brands;

  return (
    <section className="space-y-5">
      {error ? <p role="alert" className="rounded-2xl bg-[#f9e8e5] px-4 py-3 text-sm text-[#8e3f45]">{error}</p> : null}
      {notice ? <p role="status" className="rounded-2xl bg-[#e8f4eb] px-4 py-3 text-sm text-[#356a49]">{notice}</p> : null}

      {section === 'collections' || section === 'brands' ? (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={submitResource} className="section-card h-fit space-y-4 p-6">
            <div className="flex items-center gap-3"><Icon className="text-[#b87580]" size={20} /><div><p className="text-[10px] uppercase tracking-[0.24em] text-[#b87580]">Catalog</p><h3 className="mt-1 font-serif text-2xl text-[#382a2a]">{editingId ? `Edit ${section === 'brands' ? 'brand' : 'collection'}` : `Add ${section === 'brands' ? 'brand' : 'collection'}`}</h3></div></div>
            <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Name</span><input value={resourceForm.name} onChange={(event) => setResourceForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} className="admin-input" required /></label>
            <label className="block space-y-2"><span className="text-sm text-[#382a2a]">Description</span><textarea value={resourceForm.description} onChange={(event) => setResourceForm((current) => ({ ...current, description: event.target.value }))} maxLength={10000} className="admin-input min-h-24" /></label>
            <div className="space-y-3">
              <span className="text-sm text-[#382a2a]">Image</span>
              {resourceForm.image ? <img src={resourceForm.image} alt="Preview" className="h-36 w-full rounded-2xl object-cover" /> : null}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4 py-3 text-sm text-[#382a2a] hover:border-[#b87580]">
                <FileImage size={16} className="text-[#b87580]" />{uploading ? 'Uploading...' : 'Upload image'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadImage(file); }} className="sr-only" />
              </label>
              <input value={resourceForm.image} onChange={(event) => setResourceForm((current) => ({ ...current, image: event.target.value }))} maxLength={2048} className="admin-input" placeholder="Or paste an image URL or upload path" required />
            </div>
            <div className="flex gap-3"><button type="submit" disabled={busy || uploading} className="inline-flex items-center gap-2 rounded-full bg-[#382a2a] px-5 py-3 text-sm text-white hover:bg-[#b87580] disabled:opacity-60"><Save size={15} />{busy ? 'Saving...' : 'Save'}</button>{editingId ? <button type="button" onClick={resetForm} className="rounded-full border border-[#e9d8d0] px-5 py-3 text-sm">Cancel</button> : null}</div>
          </form>
          <div className="grid content-start gap-3 sm:grid-cols-2">
            {resourceList.map((resource) => (
              <article key={resource.id} className="section-card overflow-hidden">
                <img src={resource.image} alt="" className="h-40 w-full object-cover" />
                <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="truncate font-medium text-[#382a2a]">{resource.name}</h4><p className="mt-1 text-xs text-[#8a6f6d]">{resource.productCount} linked products</p><p className="mt-2 line-clamp-2 text-sm text-[#665351]">{resource.description}</p></div><div className="flex gap-2"><button type="button" aria-label={`Edit ${resource.name}`} onClick={() => { setEditingId(resource.id); setResourceForm({ name: resource.name, description: resource.description, image: resource.image }); }} className="rounded-full border border-[#eadcdf] p-2 text-[#8e5963]"><Pencil size={14} /></button><button type="button" aria-label={`Delete ${resource.name}`} onClick={() => void deleteResource(resource)} className="rounded-full border border-[#eadcdf] p-2 text-[#8e5963]"><Trash2 size={14} /></button></div></div></div>
              </article>
            ))}
            {resourceList.length === 0 ? <p className="section-card p-6 text-sm text-[#8a6f6d]">No {section} yet. Add one to start organizing your catalog.</p> : null}
          </div>
        </div>
      ) : null}

      {section === 'blog' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <form onSubmit={submitBlog} className="section-card space-y-4 p-6">
            <div><p className="text-[10px] uppercase tracking-[0.24em] text-[#b87580]">Journal</p><h3 className="mt-1 font-serif text-2xl text-[#382a2a]">{editingId ? 'Edit blog post' : 'Write a post'}</h3></div>
            <label className="block space-y-2"><span className="text-sm">Title</span><input value={blogForm.title} onChange={(event) => setBlogForm((current) => ({ ...current, title: event.target.value }))} maxLength={180} className="admin-input" required /></label>
            <label className="block space-y-2"><span className="text-sm">Excerpt</span><textarea value={blogForm.excerpt} onChange={(event) => setBlogForm((current) => ({ ...current, excerpt: event.target.value }))} maxLength={500} className="admin-input min-h-20" required /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2"><span className="text-sm">Category</span><input value={blogForm.category} onChange={(event) => setBlogForm((current) => ({ ...current, category: event.target.value }))} maxLength={80} className="admin-input" required /></label><label className="block space-y-2"><span className="text-sm">Author</span><input value={blogForm.author} onChange={(event) => setBlogForm((current) => ({ ...current, author: event.target.value }))} maxLength={120} className="admin-input" required /></label></div>
            <label className="block space-y-2"><span className="text-sm">Article</span><textarea value={blogForm.content} onChange={(event) => setBlogForm((current) => ({ ...current, content: event.target.value }))} maxLength={50000} className="admin-input min-h-48" required /></label>
            <div className="space-y-3"><span className="text-sm">Cover image</span>{blogForm.image ? <img src={blogForm.image} alt="Blog preview" className="h-36 w-full rounded-2xl object-cover" /> : null}<label className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#e9d8d0] bg-white px-4 py-3 text-sm hover:border-[#b87580]"><FileImage size={16} className="text-[#b87580]" />{uploading ? 'Uploading...' : 'Upload cover image'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadImage(file); }} className="sr-only" /></label><input value={blogForm.image} onChange={(event) => setBlogForm((current) => ({ ...current, image: event.target.value }))} maxLength={2048} className="admin-input" placeholder="Image URL or uploaded path" required /></div>
            <label className="flex items-center gap-3 text-sm text-[#382a2a]"><input type="checkbox" checked={blogForm.published} onChange={(event) => setBlogForm((current) => ({ ...current, published: event.target.checked }))} className="h-4 w-4 accent-[#9b626d]" />Publish this post</label>
            <div className="flex gap-3"><button type="submit" disabled={busy || uploading} className="rounded-full bg-[#382a2a] px-5 py-3 text-sm text-white hover:bg-[#b87580] disabled:opacity-60">{busy ? 'Saving...' : editingId ? 'Save post' : 'Create post'}</button>{editingId ? <button type="button" onClick={resetForm} className="rounded-full border border-[#e9d8d0] px-5 py-3 text-sm">Cancel</button> : null}</div>
          </form>
          <div className="space-y-3">
            {posts.map((post) => <article key={post.id} className="section-card flex gap-4 p-4"><img src={post.image} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="truncate font-medium text-[#382a2a]">{post.title}</h4><p className="mt-1 text-xs text-[#8a6f6d]">{post.category} · {post.published ? 'Published' : 'Draft'}</p><p className="mt-2 line-clamp-2 text-sm text-[#665351]">{post.excerpt}</p></div><div className="flex gap-2"><button type="button" aria-label={`Edit ${post.title}`} onClick={() => { setEditingId(post.id); setBlogForm({ title: post.title, excerpt: post.excerpt, content: post.content, category: post.category, image: post.image, author: post.author, published: post.published }); }} className="rounded-full border border-[#eadcdf] p-2 text-[#8e5963]"><Pencil size={14} /></button><button type="button" aria-label={`Delete ${post.title}`} onClick={() => void deleteBlogPost(post)} className="rounded-full border border-[#eadcdf] p-2 text-[#8e5963]"><Trash2 size={14} /></button></div></div></div></article>)}
            {posts.length === 0 ? <p className="section-card p-6 text-sm text-[#8a6f6d]">No blog posts yet.</p> : null}
          </div>
        </div>
      ) : null}

      {section === 'users' ? (
        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <form onSubmit={submitAccount} className="section-card h-fit space-y-4 p-6">
            <div><p className="text-[10px] uppercase tracking-[0.24em] text-[#b87580]">Access control</p><h3 className="mt-1 font-serif text-2xl text-[#382a2a]">Add administrator</h3><p className="mt-2 text-sm text-[#8a6f6d]">Every account created here has full administrator access.</p></div>
            <label className="block space-y-2"><span className="text-sm">Name</span><input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} maxLength={120} className="admin-input" required /></label>
            <label className="block space-y-2"><span className="text-sm">Email</span><input type="email" autoComplete="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} maxLength={254} className="admin-input" required /></label>
            <label className="block space-y-2"><span className="text-sm">Temporary password</span><input type="password" autoComplete="new-password" value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} minLength={12} maxLength={1024} className="admin-input" required /><span className="block text-xs text-[#8a6f6d]">Use at least 12 characters. Share it securely and ask them to change it.</span></label>
            <label className="flex items-start gap-3 rounded-2xl border border-[#f0dfda] bg-[#fdf9f8] p-4 text-sm text-[#382a2a]">
              <input
                type="checkbox"
                checked={accountForm.emailTwoFactorEnabled}
                onChange={(event) => setAccountForm((current) => ({
                  ...current,
                  emailTwoFactorEnabled: event.target.checked,
                }))}
                className="mt-0.5 h-4 w-4 accent-[#9b626d]"
              />
              <span>
                Enable optional email verification at sign-in
                <span className="mt-1 block text-xs leading-5 text-[#8a6f6d]">
                  This administrator will enter a one-time email code after their password. It stays optional for accounts that leave this unchecked; enabling it requires SMTP configuration.
                </span>
              </span>
            </label>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#382a2a] px-5 py-3 text-sm text-white hover:bg-[#b87580] disabled:opacity-60"><Plus size={15} />{busy ? 'Creating...' : 'Create account'}</button>
          </form>
          <div className="space-y-3">
            {users.map((account) => <article key={account.id} className="section-card flex items-center justify-between gap-4 p-5"><div><h4 className="font-medium text-[#382a2a]">{account.name}</h4><p className="mt-1 text-sm text-[#8a6f6d]">{account.email}</p><span className="mt-2 inline-block rounded-full bg-[#f7efee] px-3 py-1 text-xs text-[#8e5963]">{account.role}</span><span className={`ml-2 mt-2 inline-block rounded-full px-3 py-1 text-xs ${account.emailTwoFactorEnabled ? 'bg-[#e8f4eb] text-[#356a49]' : 'bg-[#f5f0ec] text-[#8a6f6d]'}`}>{account.emailTwoFactorEnabled ? 'Email 2FA enabled' : 'Password only'}</span></div><button type="button" onClick={() => void deleteAccount(account)} aria-label={`Delete ${account.email}`} className="rounded-full border border-[#eadcdf] p-2 text-[#8e5963] hover:border-[#b87580]"><Trash2 size={16} /></button></article>)}
            {users.length === 0 ? <p className="section-card p-6 text-sm text-[#8a6f6d]">No administrator accounts found.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
