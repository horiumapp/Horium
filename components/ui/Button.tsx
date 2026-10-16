
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
  const baseStyles = "inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20";

  const variants = {
    primary: "bg-primary text-white shadow-sm shadow-primary/20 hover:brightness-95",
    secondary: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700/70",
    ghost: "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
    danger: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40",
    soft: "bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary/20 dark:hover:bg-primary/30"
  };

  const sizes = {
    sm: "min-h-9 px-3 text-xs rounded-lg",
    md: "min-h-10 px-4 text-sm rounded-xl",
    lg: "min-h-12 px-6 text-base rounded-xl"
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
      ) : (
        <>
          {leftIcon && <span className="mr-2 flex items-center">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2 flex items-center">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};
