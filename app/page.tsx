'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, RefreshCcw } from 'lucide-react';
import { CategoryFilter } from '@/components/CategoryFilter';
import { LinkForm } from '@/components/LinkForm';
import { LinkList } from '@/components/LinkList';
import { Modal } from '@/components/ui/Modal';
import { SearchBar } from '@/components/SearchBar';
import type { Link } from '@/lib/types';

function buildCatalog(items: Link[]) {
  const categories = new Set<string>();
  const tags = new Set<string>();

  for (const item of items) {
    if (item.category?.trim()) {
      categories.add(item.category.trim());
    }

    for (const tag of item.tags) {
      if (tag.trim()) {
        tags.add(tag.trim());
      }
    }
  }

  return {
    categories: Array.from(categories).sort((left, right) => left.localeCompare(right)),
    tags: Array.from(tags).sort((left, right) => left.localeCompare(right)),
  };
}

function LinkListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-100" />
            <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [catalog, setCatalog] = useState<{ categories: string[]; tags: string[] }>({
    categories: [],
    tags: [],
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const requestIdRef = useRef(0);

  const loadLinks = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set('q', search.trim());
    }

    if (category.trim()) {
      params.set('category', category.trim());
    }

    if (tag.trim()) {
      params.set('tag', tag.trim());
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/links${params.toString() ? `?${params.toString()}` : ''}`);
      const result = await response.json();

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch links');
      }

      const nextLinks = (result.data || []) as Link[];
      setLinks(nextLinks);

      if (!search.trim() && !category.trim() && !tag.trim()) {
        setCatalog(buildCatalog(nextLinks));
      }
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch links';
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [search, category, tag]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLinks();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadLinks]);

  const catalogCategories = useMemo(() => catalog.categories, [catalog.categories]);
  const catalogTags = useMemo(() => catalog.tags, [catalog.tags]);
  const hasActiveFilters = Boolean(search.trim() || category.trim() || tag.trim());

  const handleSaved = (savedLink: Link) => {
    setEditingLink(null);
    setCatalog((current) => {
      const next = buildCatalog([savedLink, ...links]);
      return {
        categories: Array.from(new Set([...current.categories, ...next.categories])).sort((left, right) => left.localeCompare(right)),
        tags: Array.from(new Set([...current.tags, ...next.tags])).sort((left, right) => left.localeCompare(right)),
      };
    });
    toast.success('Link saved successfully!');
    void loadLinks();
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/links/${id}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete link');
      }

      toast.success('Link deleted successfully!');
      void loadLinks();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Failed to delete link';
      toast.error(message);
    }
  };

  const handleRetry = () => {
    void loadLinks();
  };

  const openCreateForm = () => {
    setEditingLink(null);
    setIsFormOpen(true);
  };

  const openEditForm = (link: Link) => {
    setEditingLink(link);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingLink(null);
  };

  const isInitialLoading = isLoading && links.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">LinkHub</h1>
            <p className="text-sm text-gray-500">Save, search, edit, and access your favorite links fast.</p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add link
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <SearchBar value={search} onChange={setSearch} />
          <CategoryFilter
            categories={catalogCategories}
            tags={catalogTags}
            category={category}
            tag={tag}
            onCategoryChange={setCategory}
            onTagChange={setTag}
            onClear={() => {
              setCategory('');
              setTag('');
            }}
          />
        </section>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">We couldn&apos;t load your links.</p>
                <p className="mt-1 text-sm text-red-700/80">{error}</p>
              </div>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {isLoading && !isInitialLoading ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Refreshing links...
          </div>
        ) : null}

        {isInitialLoading ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center shadow-sm">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <p className="mt-4 text-sm text-gray-600">Loading links...</p>
            </div>
            <LinkListSkeleton />
          </div>
        ) : (
          <LinkList
            links={links}
            onAddClick={openCreateForm}
            onEdit={openEditForm}
            onDelete={handleDelete}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={() => {
              setSearch('');
              setCategory('');
              setTag('');
            }}
          />
        )}
      </main>

      <Modal
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editingLink ? 'Edit link' : 'Add new link'}
      >
        <LinkForm
          key={editingLink?._id ?? 'create'}
          mode={editingLink ? 'edit' : 'create'}
          initialLink={editingLink}
          onSuccess={handleSaved}
          onClose={closeForm}
        />
      </Modal>
    </div>
  );
}
