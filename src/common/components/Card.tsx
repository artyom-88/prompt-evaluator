import type { HTMLAttributes, ReactElement } from 'react';

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement => {
  return (
    <div className={['rounded-lg border border-stone-200 bg-white shadow-sm', className].filter(Boolean).join(' ')} {...props} />
  );
};

export const CardHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement => {
  return <div className={['border-b border-stone-100 px-5 py-4', className].filter(Boolean).join(' ')} {...props} />;
};

export const CardContent = ({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement => {
  return <div className={['px-5 py-4', className].filter(Boolean).join(' ')} {...props} />;
};
