"use client";

import { useOfflineSync } from "@/src/hooks/useOfflineSync";

export function OfflineIndicator() {
  const { isOnline } = useOfflineSync();

  if (isOnline) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg font-medium text-sm animate-bounce">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-3.536 4.978 4.978 0 011.414-3.536m-2.828 9.9a9 9 0 01-6.364-6.364 9 9 0 016.364-6.364" />
      </svg>
      Offline Mode — Working Locally
    </div>
  );
}
