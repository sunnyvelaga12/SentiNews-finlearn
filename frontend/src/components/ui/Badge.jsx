import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const Badge = ({ children, variant = 'blue', className, ...props }) => {
    const variants = {
        blue: 'bg-blue-50 text-senti-blue border border-blue-200',
        emerald: 'bg-emerald-50 text-senti-emerald border border-emerald-200',
        amber: 'bg-amber-50 text-senti-amber border border-amber-200',
        slate: 'bg-slate-100 text-slate-700 border border-slate-200',
        rose: 'bg-rose-50 text-senti-rose border border-rose-200',
    };
    return (<span className={twMerge(clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase', variants[variant], className))} {...props}>
      {children}
    </span>);
};
