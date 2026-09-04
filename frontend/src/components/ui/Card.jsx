import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const Card = ({ children, glass = false, className, ...props }) => {
    return (<div className={twMerge(clsx('rounded-2xl p-6 transition-all duration-200 border border-slate-200/80 bg-white shadow-card', glass && 'glass-card', className))} {...props}>
      {children}
    </div>);
};
