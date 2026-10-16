
import React from 'react';

interface SelectOption {
    value: string | number;
    label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: SelectOption[];
    error?: string;
}

export const Select: React.FC<SelectProps> = ({
    label,
    options,
    error,
    className = '',
    id,
    ...props
}) => {
    const selectId = id || props.name;
    const messageId = selectId ? `${selectId}-message` : undefined;

    return (
        <div className={`flex flex-col gap-1.5 ${className}`}>
            {label && (
                <label htmlFor={selectId} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    id={selectId}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? messageId : undefined}
                    className={`w-full bg-white dark:bg-[#101822] text-gray-900 dark:text-gray-100 border rounded-xl h-11 px-3.5 pr-10 text-sm font-medium outline-none transition-colors appearance-none
            ${error
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-primary'
                        }`}
                    {...props}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" aria-hidden="true">
                    <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </div>
            </div>
            {error && (
                <span id={messageId} className="text-xs font-medium text-red-600 dark:text-red-400">
                    {error}
                </span>
            )}
        </div>
    );
};
