import type { HTMLAttributes } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['rounded-lg border border-stone-200 bg-white shadow-sm', className].filter(Boolean).join(' ')} {...props} />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['border-b border-stone-100 px-5 py-4', className].filter(Boolean).join(' ')} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['px-5 py-4', className].filter(Boolean).join(' ')} {...props} />;
}
