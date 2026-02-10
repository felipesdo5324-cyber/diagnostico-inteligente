
import React from 'react';
import { Loader2 } from 'lucide-react';

interface UIProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const Card = ({ children, className = "", ...props }: UIProps) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`} {...props}>{children}</div>
);

export const CardHeader = ({ children, className = "", ...props }: UIProps) => (
  <div className={`px-6 py-4 border-b border-slate-100 ${className}`} {...props}>{children}</div>
);

export const CardTitle = ({ children, className = "", ...props }: UIProps) => (
  <h3 className={`text-lg font-bold text-slate-900 ${className}`} {...props}>{children}</h3>
);

export const CardDescription = ({ children, className = "", ...props }: UIProps) => (
  <p className={`text-sm text-slate-500 ${className}`} {...props}>{children}</p>
);

export const CardContent = ({ children, className = "", ...props }: UIProps) => (
  <div className={`p-6 ${className}`} {...props}>{children}</div>
);

export const Button = ({ children, onClick, className = "", disabled = false, variant = "default", type = "button", size = "default", ...props }: any) => {
  const variants: any = {
    default: "bg-indigo-700 hover:bg-indigo-800 text-white shadow-md",
    outline: "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
    success: "bg-green-600 hover:bg-green-700 text-white",
    destructive: "bg-red-600 hover:bg-red-700 text-white",
    orange: "bg-orange-600 hover:bg-orange-700 text-white",
  };
  
  const sizes: any = {
    default: "px-4 py-2",
    icon: "p-2",
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`${sizes[size]} rounded-lg font-medium transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Input = ({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) => {
  const hasBg = className.includes('bg-');
  const hasText = className.includes('text-');
  
  return (
    <input 
      {...props} 
      className={`w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all 
        ${!hasBg ? 'bg-white' : ''} 
        ${!hasText ? 'text-slate-900' : ''} 
        ${className}`} 
    />
  );
};

export const Label = ({ children, className = "", ...props }: UIProps) => (
  <label className={`block text-sm font-bold text-slate-700 mb-1 ${className}`} {...props}>{children}</label>
);

export const Textarea = ({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => {
  const hasBg = className.includes('bg-');
  const hasText = className.includes('text-');

  return (
    <textarea 
      {...props} 
      className={`w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all 
        ${!hasBg ? 'bg-white' : ''} 
        ${!hasText ? 'text-slate-900' : ''} 
        ${className}`} 
    />
  );
};

export const Badge = ({ children, className = "", ...props }: UIProps) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${className}`} {...props}>
    {children}
  </span>
);

export const Checkbox = ({ checked, onCheckedChange, className = "", ...props }: { checked: boolean, onCheckedChange: (val: boolean) => void, className?: string, [key: string]: any }) => (
  <div 
    onClick={() => onCheckedChange(!checked)}
    className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${checked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'} ${className}`}
    {...props}
  >
    {checked && (
      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    )}
  </div>
);

export const Select = ({ value, onValueChange, children, ...props }: any) => {
  return (
    <div className="relative">
      <select 
        value={value} 
        onChange={(e) => onValueChange(e.target.value)}
        className="w-full appearance-none px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all pr-10 bg-white text-slate-900"
        {...props}
      >
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  );
};

export const LoadingOverlay = () => (
  <div className="fixed inset-0 z-[999] bg-slate-50/80 backdrop-blur-sm flex items-center justify-center">
    <div className="text-center">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
      <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Carregando Módulo...</p>
    </div>
  </div>
);
