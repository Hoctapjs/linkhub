'use client';

import { Filter, X } from 'lucide-react';

interface CategoryFilterProps {
  categories: string[];
  tags: string[];
  category: string;
  tag: string;
  onCategoryChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onClear: () => void;
}

export function CategoryFilter({
  categories,
  tags,
  category,
  tag,
  onCategoryChange,
  onTagChange,
  onClear,
}: CategoryFilterProps) {
  const hasActiveFilter = Boolean(category || tag);

  return (
    <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto]">
      <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
        <span>Category</span>
        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
        <span>Tag</span>
        <select
          value={tag}
          onChange={(event) => onTagChange(event.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">All tags</option>
          {tags.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={onClear}
          disabled={!hasActiveFilter}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
        >
          {hasActiveFilter ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
          Clear
        </button>
      </div>
    </div>
  );
}
