import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const Button = ({ children, variant = 'primary', size = 'md', fullWidth = false, className, disabled, ...props }) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
    const variants = {
        primary: 'bg-senti-blue text-white hover:bg-senti-blue-dark focus:ring-blue-500 shadow-md shadow-blue-500/10',
        secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400',
        outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-400',
        ghost: 'text-slate-600 hover:bg-slate-100 focus:ring-slate-300',
        success: 'bg-senti-emerald text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-md shadow-emerald-500/10',
    };
    const sizes = {
        sm: 'px-3 py-1.5 text-xs rounded-lg',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-6 py-3.5 text-base font-semibold',
    };
    return (<button className={twMerge(clsx(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className))} disabled={disabled} {...props}>
      {children}
    </button>);
};
