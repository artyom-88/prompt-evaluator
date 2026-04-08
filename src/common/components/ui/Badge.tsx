import type { HTMLAttributes, ReactElement } from 'react';

export const Badge = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>): ReactElement => {
  return (
    <span
      className={['inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700', className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
};
