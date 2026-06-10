'use client';

import { Plus } from 'lucide-react';
import { Link } from '@/lib/types';
import { LinkCard } from './LinkCard';

interface LinkListProps {
  links: Link[];
  onAddClick: () => void;
  onEdit: (link: Link) => void;
  onDelete: (id: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function LinkList({ links, onAddClick, onEdit, onDelete, hasActiveFilters, onClearFilters }: LinkListProps) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-sm">
        <Plus className="mb-4 h-12 w-12 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-900">
          {hasActiveFilters ? 'No matches found' : 'No links yet'}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
          {hasActiveFilters
            ? 'Try clearing the search or filters to see the full collection again.'
            : 'Start by adding your first link. You can search, edit, and filter everything from here once your collection grows.'}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Clear filters
            </button>
          ) : null}
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Add your first link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {links.map((link) => (
        <LinkCard key={link._id} link={link} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
