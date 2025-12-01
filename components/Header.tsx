import React from 'react';
import { Aperture, Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-[#0D0E12] border-b border-[#2A2B32] p-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-cyan-500 p-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Aperture className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Harding <span className="font-light text-slate-500 text-sm border border-slate-700 px-1.5 rounded">Pro AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <a href="#" className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#15161A] border border-[#2A2B32] hover:border-slate-600 transition-colors">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-400">Gemini 2.5 Inside</span>
          </a>
        </div>
      </div>
    </header>
  );
};