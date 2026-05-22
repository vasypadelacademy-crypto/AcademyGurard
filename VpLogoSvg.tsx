import React from 'react';

export const VpLogoSvg = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="5" />
    <path d="M 28 32 L 42 66" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    <path d="M 44 75 L 62 26" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    <path d="M 55 42 L 67 42 C 74 42 78 46 78 52 C 78 58 74 62 66 62 L 50 62" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 61 34 L 72 34 L 66.5 24 Z" fill="currentColor" />
  </svg>
);
