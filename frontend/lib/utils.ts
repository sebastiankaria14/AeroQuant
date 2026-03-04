import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency = "₹"): string {
  if (price >= 100000) return `${currency}${(price / 100000).toFixed(1)}L`;
  if (price >= 1000) return `${currency}${(price / 1000).toFixed(1)}K`;
  return `${currency}${price.toLocaleString("en-IN")}`;
}

export function formatPriceFull(price: number, currency = "₹"): string {
  return `${currency}${price.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function pctChange(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

export function clampNumber(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
