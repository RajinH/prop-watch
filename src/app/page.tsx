"use client";

import { useReducer, useMemo, useEffect, useCallback } from "react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-10 flex flex-col gap-5">
        {/* Header */}
        <header className="text-center mb-1">
          <h1 className="text-5xl font-black text-[#005412] tracking-tight">
            PropWatch
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Property investing without the guesswork.
          </p>
        </header>
      </div>
    </main>
  );
}
