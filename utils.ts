import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function parseTimeTo24h(timeStr: string) {
  if (!timeStr) return '17:00';
  
  // Clean up the string
  const cleaned = timeStr.trim().replace(/\u00a0/g, ' '); // Replace non-breaking spaces

  // Handle Excel decimal times (e.g., 0.85)
  if (!isNaN(parseFloat(cleaned)) && cleaned.includes('.')) {
    const num = parseFloat(cleaned);
    if (num >= 0 && num < 1) {
      const totalMinutes = Math.round(num * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  // Handle AM/PM
  const match = cleaned.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?/i);
  if (match) {
      let [_, h, m, ampm] = match;
      let hours = parseInt(h);
      const minutes = m;
      if (ampm) {
          if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
          else if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
      }
      return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  // If already 24h
  if (cleaned.match(/^\d{1,2}:\d{2}$/)) {
      const [h, m] = cleaned.split(':');
      return `${String(parseInt(h)).padStart(2, '0')}:${m}`;
  }
  return '17:00';
}

export function getSortableDate(dateStr: string): string {
  if (!dateStr) return '00000000';
  const clean = dateStr.trim();
  if (clean.includes('/')) {
    const [d, m, y] = clean.split('/');
    if (y && m && d) {
      return `${y}${m.padStart(2, '0')}${d.padStart(2, '0')}`;
    }
  }
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return clean.replace(/-/g, '');
      return `${parts[2]}${parts[1].padStart(2, '0')}${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { parseISO as datefnsParseISO } from 'date-fns';

export function safeParseISO(val: any): Date {
  if (!val) return new Date();
  if (val?.toDate) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  
  if (typeof val === 'string') {
    // If it's just a time like '17:00'
    if (val.match(/^\d{2}:\d{2}$/)) {
        const [h, m] = val.split(':');
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m), 0, 0);
        return d;
    }
  }

  return datefnsParseISO(val);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatKLE(amount: number) {
  if (Math.abs(amount) >= 1000) {
    const value = amount / 1000;
    return `${new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)} KLE`;
  }
  return formatCurrency(amount);
}

export function toTitleCase(str: string) {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ').toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function formatTimeAMPM(time24: string) {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

const DISTINCT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#a855f7', // purple
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#f43f5e', // rose
  '#22c55e', // green
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#d946ef', // fuchsia
  '#f43f5e', // rose
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#0891b2', // cyan-600
  '#4f46e5', // indigo-600
  '#c026d3', // fuchsia-600
  '#db2777', // pink-600
  '#e11d48', // rose-600
  '#ea580c', // orange-600
  '#ca8a04', // yellow-600
  '#65a30d', // lime-600
  '#16a34a', // green-600
  '#059669', // emerald-600
  '#0d9488', // teal-600
];

export function getGroupColor(seed: string, color?: string) {
  if (color && color !== '#1e293b' && color !== '#000000') return color;
  
  // Hash the seed to pick a color
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % DISTINCT_COLORS.length;
  return DISTINCT_COLORS[index];
}

export { DISTINCT_COLORS };
