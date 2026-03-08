import React from 'react';
import { useBalance } from '@/contexts/BalanceContext';
import { Wallet, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface BalanceWidgetProps {
  compact?: boolean;
  variant?: 'default' | 'hero';
}

export function BalanceWidget({ compact, variant = 'default' }: BalanceWidgetProps) {
  const { balance, isLoading } = useBalance();

  if (compact) {
    return (
      <NavLink
        to="/topup"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
        title="Баланс"
      >
        <Wallet className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-bold text-primary">
          {isLoading ? '...' : `${balance.toFixed(0)}₽`}
        </span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to="/topup"
      className={
        variant === 'hero'
          ? "flex items-center gap-3 rounded-xl px-3 py-3 transition-colors group"
          : "flex items-center gap-3 p-3 rounded-xl bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-colors group"
      }
      style={variant === 'hero' ? undefined : { background: 'hsl(263 52% 50% / 0.07)' }}
    >
      <div className={variant === 'hero'
        ? "flex h-8 w-8 items-center justify-center rounded-lg bg-primary/14"
        : "w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center"}>
        <Wallet className={variant === 'hero' ? "h-4 w-4 text-primary" : "w-4 h-4 text-primary"} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={variant === 'hero' ? "text-xs font-semibold text-foreground/95" : "text-xs font-semibold text-foreground"}>Баланс</span>
          <span className={variant === 'hero' ? "text-sm font-bold text-primary" : "text-sm font-bold text-primary"}>
            {isLoading ? '...' : `${balance.toFixed(2)} ₽`}
          </span>
        </div>
      </div>
      <Plus className={variant === 'hero'
        ? "w-4 h-4 text-primary/90 opacity-90 group-hover:opacity-100 transition-opacity"
        : "w-4 h-4 text-primary opacity-50 group-hover:opacity-100 transition-opacity"} />
    </NavLink>
  );
}
