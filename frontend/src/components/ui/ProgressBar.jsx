import React from 'react';
export const ProgressBar = ({ progress, height = 'h-2.5', color = 'bg-senti-blue', className = '', }) => {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    return (<div className={`w-full bg-slate-100 rounded-full overflow-hidden ${height} ${className}`}>
      <div className={`h-full ${color} transition-all duration-500 ease-out rounded-full`} style={{ width: `${clampedProgress}%` }}/>
    </div>);
};
