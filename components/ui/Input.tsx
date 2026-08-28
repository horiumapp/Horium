
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

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && (
                <label htmlFor={inputId} className="text-[10px] font-black uppercase text-gray-400">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={`w-full bg-gray-50 dark:bg-[#1a2634] border-2 rounded-lg h-11 px-4 font-bold outline-none transition-all
          ${error
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-gray-100 dark:border-gray-700/50 focus:border-primary'
                    }`}
                {...props}
            />
            {(error || helperText) && (
                <span className={`text-[10px] font-bold ${error ? 'text-red-500' : 'text-gray-400'}`}>
                    {error || helperText}
                </span>
            )}
        </div>
    );
};
