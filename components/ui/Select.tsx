
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

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && (
                <label htmlFor={selectId} className="text-[10px] font-black uppercase text-gray-400">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    id={selectId}
                    className={`w-full bg-gray-50 dark:bg-[#1a2634] border-2 rounded-lg h-11 px-3 pr-10 font-bold outline-none transition-all appearance-none bg-none
            ${error
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-gray-100 dark:border-gray-700/50 focus:border-primary'
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
                <span className="text-[10px] font-bold text-red-500">
                    {error}
                </span>
            )}
        </div>
    );
};
