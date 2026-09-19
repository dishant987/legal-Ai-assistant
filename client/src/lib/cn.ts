import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Join class names, letting later Tailwind utilities win over earlier ones.
 *
 * Without the merge, `cn('p-2', 'p-4')` emits both and the winner depends on
 * stylesheet order rather than call order — which makes a component's `className`
 * prop unreliable for the one thing it exists to do.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
