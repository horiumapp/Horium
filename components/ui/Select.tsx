
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
    const descriptionId = selectId ? `${selectId}-description` : undefined;

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && (
                <label htmlFor={selectId} className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    id={selectId}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? descriptionId : undefined}
                    className={`w-full bg-white dark:bg-slate-900 border rounded-xl min-h-11 px-3.5 pr-10 text-sm text-gray-900 dark:text-gray-100 outline-none transition-all appearance-none focus:ring-4 focus:ring-primary/10
            ${error
                            ? 'border-red-400 focus:border-red-500'
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
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <span className="material-symbols-outlined">expand_more</span>
                </div>
            </div>
            {error && (
                    <span id={descriptionId} className="text-xs text-red-600 dark:text-red-400">
                    {error}
                </span>
            )}
        </div>
    );
};
