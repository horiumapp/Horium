
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
    const messageId = inputId ? `${inputId}-message` : undefined;

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label htmlFor={inputId} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                aria-invalid={error ? true : undefined}
                aria-describedby={error || helperText ? messageId : undefined}
                className={`w-full bg-white dark:bg-[#101822] text-gray-900 dark:text-gray-100 border rounded-xl h-11 px-3.5 text-sm font-medium outline-none transition-colors placeholder:text-gray-400 placeholder:font-normal
          ${error
                        ? 'border-red-500 focus:border-red-500'
                        : 'border-gray-200 dark:border-gray-700 focus:border-primary'
                    }`}
                {...props}
            />
            {(error || helperText) && (
                <span id={messageId} className={`text-xs font-medium ${error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {error || helperText}
                </span>
            )}
        </div>
    );
};
