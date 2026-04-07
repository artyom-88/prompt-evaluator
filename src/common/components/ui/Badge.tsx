import type { HTMLAttributes } from 'react';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={['inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}
