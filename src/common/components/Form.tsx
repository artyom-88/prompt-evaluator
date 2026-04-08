import type { HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactElement, TextareaHTMLAttributes } from 'react';

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>): ReactElement => {
  // biome-ignore lint/a11y/noLabelWithoutControl: Consumer fields pass htmlFor through props.
  return <label className={['text-sm font-medium text-stone-800', className].filter(Boolean).join(' ')} {...props} />;
};

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): ReactElement => {
  const inputClassName = [
    'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <input className={inputClassName} {...props} />;
};

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement => {
  const textareaClassName = [
    'w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <textarea className={textareaClassName} {...props} />;
};

export const Field = ({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement => {
  return <div className={['space-y-2', className].filter(Boolean).join(' ')} {...props} />;
};
