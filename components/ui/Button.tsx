
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  const variants = {
    primary: "bg-primary text-white shadow-sm shadow-primary/25 hover:bg-[#0f5fd0]",
    secondary: "bg-white dark:bg-[#152233] text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-800",
    ghost: "bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
    danger: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40",
    soft: "bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/20 dark:hover:bg-primary/30"
  };

  const sizes = {
    sm: "h-8 px-3 text-xs rounded-lg",
    md: "h-10 px-4 text-sm rounded-xl",
    lg: "h-12 px-6 text-base rounded-xl"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="material-symbols-outlined motion-safe:animate-spin text-lg" aria-hidden="true">progress_activity</span>
          <span className="sr-only">Carregando</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="flex items-center" aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex items-center" aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
