'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type RadioGroupProps = {
  children: React.ReactNode;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

export function RadioGroup({ children, onValueChange }: RadioGroupProps) {
  const handleChange = (e: React.ChangeEvent<HTMLDivElement>) => {
    const target = e.target as HTMLInputElement;
    if (target?.type === 'radio' && onValueChange) {
      onValueChange(target.value);
    }
  };

  return (
    <div onChange={handleChange}>
      {children}
    </div>
  );
}

type RadioGroupItemProps = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  value: string;
};

export function RadioGroupItem({
  id,
  value,
  className,
  ...props
}: RadioGroupItemProps) {
  return (
    <input
      type="radio"
      id={id}
      value={value}
      className={cn(
        'mr-2 h-4 w-4 border-gray-300 text-[#00a1e9] focus:ring-[#00a1e9]',
        className
      )}
      {...props}
    />
  );
}
