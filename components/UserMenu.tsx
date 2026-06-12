'use client';

import { signOut } from 'next-auth/react';
import { LogOut, User } from 'lucide-react';
import { useState } from 'react';

interface UserMenuProps {
  email: string;
  name?: string | null;
}

export function UserMenu({ email, name }: UserMenuProps) {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ redirectTo: '/login' });
  };

  const displayName = name || email;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <User className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="max-w-[160px] truncate text-sm text-gray-700" title={displayName}>
          {displayName}
        </span>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" />
        {signingOut ? 'Signing out...' : 'Sign out'}
      </button>
    </div>
  );
}
