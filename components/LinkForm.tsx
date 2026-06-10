'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { Loader2, Sparkles } from 'lucide-react';
import { Link } from '@/lib/types';
import { createLinkSchema, updateLinkSchema } from '@/lib/validation';

interface LinkFormProps {
  mode: 'create' | 'edit';
  initialLink?: Link | null;
  onSuccess: (link: Link) => void;
  onClose: () => void;
}

interface FormState {
  url: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  favicon: string;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeTags(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of value.split(/[\n,]/)) {
    const trimmed = tag.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function buildInitialFormState(mode: 'create' | 'edit', initialLink?: Link | null): FormState {
  if (mode === 'edit' && initialLink) {
    return {
      url: initialLink.url,
      title: initialLink.title,
      description: initialLink.description ?? '',
      category: initialLink.category ?? '',
      tags: initialLink.tags.join(', '),
      favicon: initialLink.favicon ?? '',
    };
  }

  return {
    url: '',
    title: '',
    description: '',
    category: '',
    tags: '',
    favicon: '',
  };
}

export function LinkForm({ mode, initialLink, onSuccess, onClose }: LinkFormProps) {
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(() => Boolean(initialLink?.favicon || initialLink?.description));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormState>(() => buildInitialFormState(mode, initialLink));
  const lastFetchedUrlRef = useRef(initialLink?.url ?? '');

  const fetchMetadata = useCallback(async (url: string) => {
    if (!isHttpUrl(url)) {
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const response = await fetch(`/api/metadata?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch metadata');
      }

      const metadata = data.data ?? {};
      setFormData((prev) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : metadata.title || prev.title,
        description: prev.description.trim() ? prev.description : metadata.description || prev.description,
        favicon: metadata.favicon || prev.favicon,
      }));
      setMetadataLoaded(true);
      lastFetchedUrlRef.current = url;
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
      setMetadataLoaded(false);
    } finally {
      setIsFetchingMetadata(false);
    }
  }, []);

  useEffect(() => {
    const url = formData.url.trim();

    if (!url || url === lastFetchedUrlRef.current || !isHttpUrl(url)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void fetchMetadata(url);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [fetchMetadata, formData.url]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      const tagsArray = normalizeTags(formData.tags);
      const trimmedTitle = formData.title.trim();
      const trimmedUrl = formData.url.trim();
      const trimmedDescription = formData.description.trim();
      const trimmedCategory = formData.category.trim();
      const trimmedFavicon = formData.favicon.trim();

      const payload =
        mode === 'create'
          ? {
              title: trimmedTitle,
              url: trimmedUrl,
              description: trimmedDescription || undefined,
              category: trimmedCategory || undefined,
              favicon: trimmedFavicon || undefined,
              tags: tagsArray,
            }
          : {
              title: trimmedTitle,
              url: trimmedUrl,
              description: trimmedDescription ? trimmedDescription : null,
              category: trimmedCategory ? trimmedCategory : null,
              favicon: trimmedFavicon || undefined,
              tags: tagsArray,
            };

      const validated =
        mode === 'create'
          ? createLinkSchema.parse(payload)
          : updateLinkSchema.parse(payload);

      const response = await fetch(
        mode === 'create' ? '/api/links' : `/api/links/${initialLink?._id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validated),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${mode === 'create' ? 'create' : 'update'} link`);
      }

      toast.success(mode === 'create' ? 'Link added successfully!' : 'Link updated successfully!');
      onSuccess(result.data as Link);
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const nextErrors: Record<string, string> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          nextErrors[path] = issue.message;
        }
        setErrors(nextErrors);
        return;
      }

      const message = error instanceof Error ? error.message : `Failed to ${mode === 'create' ? 'create' : 'update'} link`;
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          URL *
        </label>
        <input
          type="url"
          placeholder="https://example.com"
          value={formData.url}
          onChange={(event) => setFormData((prev) => ({ ...prev, url: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {errors.url ? <p className="mt-1 text-sm text-red-600">{errors.url}</p> : null}
        {isFetchingMetadata ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching metadata...
          </div>
        ) : metadataLoaded ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-emerald-600">
            <Sparkles className="h-4 w-4" />
            Metadata loaded
          </div>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Title *
        </label>
        <input
          type="text"
          placeholder="Link title"
          value={formData.title}
          onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {errors.title ? <p className="mt-1 text-sm text-red-600">{errors.title}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          placeholder="Add a note about this link"
          rows={3}
          value={formData.description}
          onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {errors.description ? <p className="mt-1 text-sm text-red-600">{errors.description}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Category
        </label>
        <input
          type="text"
          placeholder="e.g., Work, Personal, Dev"
          value={formData.category}
          onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        {errors.category ? <p className="mt-1 text-sm text-red-600">{errors.category}</p> : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Tags
        </label>
        <input
          type="text"
          placeholder="e.g., javascript, react, tutorial"
          value={formData.tags}
          onChange={(event) => setFormData((prev) => ({ ...prev, tags: event.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-1 text-xs text-gray-500">Separate tags with commas or new lines</p>
        {errors.tags ? <p className="mt-1 text-sm text-red-600">{errors.tags}</p> : null}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isFetchingMetadata}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSubmitting ? `${mode === 'create' ? 'Adding' : 'Saving'}...` : mode === 'create' ? 'Add link' : 'Update link'}
        </button>
      </div>
    </form>
  );
}
