import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, ChevronRight, X, Sparkles, ShieldCheck, Database, HelpCircle } from 'lucide-react';

export interface ManualGuidanceTooltipProps {
  sectionNumber: number;
  sectionId: string;
  title: string;
  category: string;
  purpose: string;
  guidanceBullets: string[];
  standardRef?: string;
  onOpenManual?: (sectionId: string) => void;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
  triggerAriaLabel?: string;
}

export const ManualGuidanceTooltip: React.FC<ManualGuidanceTooltipProps> = ({
  sectionNumber,
  sectionId,
  title,
  category,
  purpose,
  guidanceBullets,
  standardRef = 'Aplus 49-Section Master Operating Manual',
  onOpenManual,
  children,
  position = 'bottom',
  align = 'center',
  className = '',
  triggerAriaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsOpen(true), 150);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOpen]);

  // Position classes
  let positionClasses = '';
  if (position === 'bottom') {
    positionClasses = 'top-full mt-2.5';
  } else if (position === 'top') {
    positionClasses = 'bottom-full mb-2.5';
  } else if (position === 'left') {
    positionClasses = 'right-full mr-2.5 top-1/2 -translate-y-1/2';
  } else {
    positionClasses = 'left-full ml-2.5 top-1/2 -translate-y-1/2';
  }

  // Alignment classes for top/bottom
  let alignClasses = '';
  if (position === 'top' || position === 'bottom') {
    if (align === 'start') {
      alignClasses = 'left-0';
    } else if (align === 'end') {
      alignClasses = 'right-0';
    } else {
      alignClasses = 'left-1/2 -translate-x-1/2';
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex items-center gap-1.5 ${className}`}
    >
      {/* Target Element */}
      {children}

      {/* Manual Quick-Ref Icon Indicator Button */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-label={
          triggerAriaLabel ||
          `System Manual guidance for Section ${sectionNumber}: ${title}`
        }
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-100/90 hover:bg-indigo-200 text-indigo-700 hover:text-indigo-900 border border-indigo-300/80 shadow-2xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
        title={`View 49-Section Manual guidance (Section ${sectionNumber})`}
      >
        <HelpCircle className="w-2.5 h-2.5" />
      </button>

      {/* Floating Rich Tooltip Box */}
      {isOpen && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute ${positionClasses} ${alignClasses} z-50 w-72 sm:w-84 max-w-[90vw] p-4 bg-slate-900/95 text-slate-100 rounded-2xl border border-slate-700/90 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-left pointer-events-auto`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                  Section {sectionNumber} of 49
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-medium text-slate-400 bg-slate-800/80 rounded border border-slate-700/60">
                  {category}
                </span>
              </div>
              <h4 className="text-xs font-black text-white leading-tight">
                {title}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
              aria-label="Close tooltip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Purpose */}
          <div className="py-2.5 space-y-1.5 border-b border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
              Element Purpose
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {purpose}
            </p>
          </div>

          {/* Quick-Reference Guidance from 49-Section Manual */}
          <div className="py-2.5 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
              49-Section Manual SOP Guidance
            </span>
            <ul className="space-y-1 text-[11px] text-slate-300 list-none">
              {guidanceBullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-400 font-bold shrink-0">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer & Link to Full Manual */}
          <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2 text-[10px]">
            <span className="text-slate-400 truncate max-w-[130px]">
              {standardRef}
            </span>
            {onOpenManual && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onOpenManual(sectionId);
                }}
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer transition shrink-0"
              >
                <BookOpen className="w-3 h-3" />
                <span>Open in Manual</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
