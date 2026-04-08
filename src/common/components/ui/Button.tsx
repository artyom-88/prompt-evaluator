import type { ButtonHTMLAttributes, ReactElement } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-stone-950 text-white hover:bg-stone-800',
  secondary: 'border border-stone-300 bg-white text-stone-900 hover:bg-stone-50',
  ghost: 'bg-transparent text-stone-700 hover:bg-stone-200',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

export const Button = ({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }): ReactElement => {
  const buttonClassName = [
    'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    variants[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <button className={buttonClassName} {...props} />;
};
