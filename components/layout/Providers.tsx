'use client';

import { LangProvider } from '@/lib/i18n';
import { AuthProvider } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { ConfirmProvider, ToastProvider } from '@/components/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <AuthProvider>
        <CartProvider>
          <ToastProvider><ConfirmProvider>{children}</ConfirmProvider></ToastProvider>
        </CartProvider>
      </AuthProvider>
    </LangProvider>
  );
}
