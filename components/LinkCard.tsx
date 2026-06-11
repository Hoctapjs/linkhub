/* eslint-disable @next/next/no-img-element */
'use client';

import { ExternalLink, Trash2, Edit2, Sparkles } from 'lucide-react';
import { Link } from '@/lib/types';

interface LinkCardProps {
  link: Link;
  onEdit?: (link: Link) => void;
  onDelete?: (id: string) => void;
}

export function LinkCard({ link, onEdit, onDelete }: LinkCardProps) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
          {link.favicon ? (
            <img
              src={link.favicon}
              alt=""
              className="h-full w-full object-contain"
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs font-semibold text-gray-400">LINK</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1 text-base font-semibold text-blue-700 transition hover:text-blue-900"
          >
            <span className="line-clamp-2 break-words">{link.title}</span>
            <ExternalLink className="mt-0.5 h-4 w-4 flex-shrink-0" />
          </a>
          <p className="mt-1 break-all text-xs text-gray-500">{link.url}</p>
        </div>
      </div>

      {link.description ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
          {link.description}
        </p>
      ) : null}

      {link.notes ? (
        <div className="mt-3 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-purple-500" />
            <span className="text-xs font-medium text-purple-600">AI Notes</span>
          </div>
          <p className="line-clamp-3 text-sm leading-6 text-purple-900">{link.notes}</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {link.category ? (
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {link.category}
          </span>
        ) : null}
        {link.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex gap-2 pt-4">
        {onEdit ? (
          <button
            type="button"
            onClick={() => onEdit(link)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete "${link.title}"?`)) {
                onDelete(link._id);
              }
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}
