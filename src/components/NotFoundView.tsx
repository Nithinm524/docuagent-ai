import React from 'react';
import { AlertCircle, Home, UploadCloud, ArrowLeft } from 'lucide-react';

interface NotFoundViewProps {
  onGoHome: () => void;
  onGoUpload: () => void;
  invalidPath?: string;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  onGoHome,
  onGoUpload,
  invalidPath
}) => {
  return (
    <div className="py-12 sm:py-20 flex flex-col items-center justify-center text-center px-4 max-w-xl mx-auto space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
        <AlertCircle className="w-8 h-8 stroke-[2]" aria-hidden="true" />
      </div>

      <div className="space-y-2">
        <div className="inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          404 · Page Not Found
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Requested Page Not Found
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {invalidPath
            ? `The requested route or parameter "${invalidPath}" does not exist in DOCUAGENT AI.`
            : 'The requested section could not be found. Please check the address or use the navigation links below to return to active workflows.'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto pt-2">
        <button
          type="button"
          onClick={onGoHome}
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold text-xs tracking-tight shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span>Return to Dashboard</span>
        </button>

        <button
          type="button"
          onClick={onGoUpload}
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs tracking-tight shadow-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <UploadCloud className="w-4 h-4" aria-hidden="true" />
          <span>Start Document Intake</span>
        </button>
      </div>

      <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
        Need assistance? View the{' '}
        <button
          type="button"
          onClick={onGoHome}
          className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium cursor-pointer"
        >
          intake dashboard
        </button>{' '}
        or consult documentation.
      </div>
    </div>
  );
};
