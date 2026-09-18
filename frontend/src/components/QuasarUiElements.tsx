import React from 'react';

// Quasar-style Button
export interface QBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: 'primary' | 'secondary' | 'accent' | 'positive' | 'negative' | 'info' | 'warning' | 'dark' | 'white' | 'grey';
  flat?: boolean;
  outline?: boolean;
  unelevated?: boolean;
  rounded?: boolean;
  round?: boolean;
  dense?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  label?: string;
}

export const QBtn: React.FC<QBtnProps> = ({
  color = 'primary',
  flat = false,
  outline = false,
  unelevated = false,
  rounded = false,
  round = false,
  dense = false,
  loading = false,
  icon,
  iconRight,
  label,
  children,
  className = '',
  disabled,
  ...rest
}) => {
  const colorMap = {
    primary: {
      solid: 'bg-[#1976D2] text-white hover:bg-[#1565C0] active:bg-[#0D47A1]',
      flat: 'text-[#1976D2] hover:bg-[#1976D2]/10 active:bg-[#1976D2]/20',
      outline: 'border border-[#1976D2] text-[#1976D2] hover:bg-[#1976D2]/10',
    },
    secondary: {
      solid: 'bg-[#26A69A] text-white hover:bg-[#00897B] active:bg-[#00796B]',
      flat: 'text-[#26A69A] hover:bg-[#26A69A]/10 active:bg-[#26A69A]/20',
      outline: 'border border-[#26A69A] text-[#26A69A] hover:bg-[#26A69A]/10',
    },
    accent: {
      solid: 'bg-[#9C27B0] text-white hover:bg-[#8E24AA] active:bg-[#7B1FA2]',
      flat: 'text-[#9C27B0] hover:bg-[#9C27B0]/10 active:bg-[#9C27B0]/20',
      outline: 'border border-[#9C27B0] text-[#9C27B0] hover:bg-[#9C27B0]/10',
    },
    positive: {
      solid: 'bg-[#21BA45] text-white hover:bg-[#1CA03B] active:bg-[#178531]',
      flat: 'text-[#21BA45] hover:bg-[#21BA45]/10 active:bg-[#21BA45]/20',
      outline: 'border border-[#21BA45] text-[#21BA45] hover:bg-[#21BA45]/10',
    },
    negative: {
      solid: 'bg-[#C10015] text-white hover:bg-[#A80012] active:bg-[#8E0010]',
      flat: 'text-[#C10015] hover:bg-[#C10015]/10 active:bg-[#C10015]/20',
      outline: 'border border-[#C10015] text-[#C10015] hover:bg-[#C10015]/10',
    },
    info: {
      solid: 'bg-[#31CCEC] text-white hover:bg-[#28B5D1] active:bg-[#1F9EB7]',
      flat: 'text-[#31CCEC] hover:bg-[#31CCEC]/10 active:bg-[#31CCEC]/20',
      outline: 'border border-[#31CCEC] text-[#31CCEC] hover:bg-[#31CCEC]/10',
    },
    warning: {
      solid: 'bg-[#F2C037] text-slate-900 hover:bg-[#E0B02F] active:bg-[#CF9F26]',
      flat: 'text-[#B88705] hover:bg-[#F2C037]/10 active:bg-[#F2C037]/20',
      outline: 'border border-[#F2C037] text-[#B88705] hover:bg-[#F2C037]/10',
    },
    dark: {
      solid: 'bg-[#1D1D1D] text-white hover:bg-[#2D2D2D] active:bg-[#3D3D3D]',
      flat: 'text-[#1D1D1D] hover:bg-black/10 active:bg-black/20',
      outline: 'border border-[#1D1D1D] text-[#1D1D1D] hover:bg-black/10',
    },
    white: {
      solid: 'bg-white text-[#1D1D1D] hover:bg-slate-100 active:bg-slate-200',
      flat: 'text-white hover:bg-white/10 active:bg-white/20',
      outline: 'border border-white text-white hover:bg-white/10',
    },
    grey: {
      solid: 'bg-slate-200 text-slate-800 hover:bg-slate-300 active:bg-slate-400',
      flat: 'text-slate-600 hover:bg-slate-500/10 active:bg-slate-500/20',
      outline: 'border border-slate-300 text-slate-700 hover:bg-slate-100',
    },
  };

  const styleType = flat ? 'flat' : outline ? 'outline' : 'solid';
  const colorClasses = colorMap[color][styleType];
  const shadowClass = flat || outline || unelevated ? '' : 'q-shadow-1 active:shadow-none';

  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium text-sm transition-all duration-150 select-none cursor-pointer
        ${dense ? 'px-2 py-1 text-xs' : round ? 'p-2' : 'px-4 py-2'}
        ${round ? 'rounded-full' : rounded ? 'rounded-xl' : 'rounded'}
        ${colorClasses}
        ${shadowClass}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : (
        icon && <span className={label || children ? 'mr-1.5' : ''}>{icon}</span>
      )}
      {label || children}
      {iconRight && <span className="ml-1.5">{iconRight}</span>}
    </button>
  );
};

// Quasar-style Chip
export const QChip: React.FC<{
  label?: string;
  color?: string;
  textColor?: string;
  icon?: React.ReactNode;
  dense?: boolean;
  clickable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  children?: React.ReactNode;
  className?: string;
}> = ({
  label,
  color,
  textColor = 'text-white',
  icon,
  dense = false,
  clickable = false,
  selected = false,
  onClick,
  onRemove,
  children,
  className = '',
}) => {
  return (
    <span
      onClick={clickable ? onClick : undefined}
      style={{ backgroundColor: color || undefined }}
      className={`
        inline-flex items-center gap-1 font-medium transition-colors select-none
        ${dense ? 'px-2 py-0.5 text-xs rounded' : 'px-2.5 py-1 text-xs rounded-full'}
        ${!color ? 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' : textColor}
        ${clickable ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''}
        ${selected ? 'ring-2 ring-offset-1 ring-blue-500 font-semibold' : ''}
        ${className}
      `}
    >
      {icon && <span className="text-[11px]">{icon}</span>}
      <span>{label || children}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 opacity-70 hover:opacity-100 rounded-full"
        >
          ×
        </button>
      )}
    </span>
  );
};

// Quasar-style Badge
export const QBadge: React.FC<{
  label?: string | number;
  color?: 'primary' | 'secondary' | 'positive' | 'negative' | 'warning' | 'info' | 'dark';
  children?: React.ReactNode;
  floating?: boolean;
  className?: string;
}> = ({ label, color = 'primary', children, floating = false, className = '' }) => {
  const colorMap = {
    primary: 'bg-[#1976D2] text-white',
    secondary: 'bg-[#26A69A] text-white',
    positive: 'bg-[#21BA45] text-white',
    negative: 'bg-[#C10015] text-white',
    warning: 'bg-[#F2C037] text-slate-900',
    info: 'bg-[#31CCEC] text-white',
    dark: 'bg-[#1D1D1D] text-white',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-bold text-[10px] px-1.5 py-0.5 rounded
        ${colorMap[color]}
        ${floating ? 'absolute -top-1.5 -right-1.5' : ''}
        ${className}
      `}
    >
      {label || children}
    </span>
  );
};

// Quasar-style Card
export const QCard: React.FC<{
  flat?: boolean;
  bordered?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ flat = false, bordered = true, children, className = '' }) => {
  return (
    <div
      className={`
        bg-white dark:bg-[#0f1320] rounded-lg transition-all
        ${flat ? '' : 'q-shadow-1 hover:q-shadow-2'}
        ${bordered ? 'border border-slate-200 dark:border-[#1e2333]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export const QCardSection: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <div className={`p-4 ${className}`}>{children}</div>;
};

export const QCardActions: React.FC<{
  align?: 'left' | 'right' | 'between' | 'center';
  children: React.ReactNode;
  className?: string;
}> = ({ align = 'right', children, className = '' }) => {
  const alignMap = {
    left: 'justify-start',
    right: 'justify-end',
    between: 'justify-between',
    center: 'justify-center',
  };
  return (
    <div className={`p-3 border-t border-slate-100 dark:border-[#1e2333] flex items-center gap-2 ${alignMap[align]} ${className}`}>
      {children}
    </div>
  );
};
