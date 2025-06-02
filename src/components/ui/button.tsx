import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'bg-[#00a1e9] text-white px-4 py-2 rounded-md hover:bg-[#008ec4] transition',
        className
      )}
      {...props}
    />
  );
}
