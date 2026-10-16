
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    helperText,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || props.name;
    const descriptionId = inputId ? `${inputId}-description` : undefined;

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && (
                <label htmlFor={inputId} className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={(error || helperText) ? descriptionId : undefined}
                className={`w-full bg-white dark:bg-slate-900 border rounded-xl min-h-11 px-3.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 outline-none transition-all focus:ring-4 focus:ring-primary/10
          ${error
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-gray-200 dark:border-gray-700 focus:border-primary'
                    }`}
                {...props}
            />
            {(error || helperText) && (
                <span id={descriptionId} className={`text-xs ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {error || helperText}
                </span>
            )}
        </div>
    );
};
