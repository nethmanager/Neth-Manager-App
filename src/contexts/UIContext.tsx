import React, { createContext, useContext, useState, useCallback } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { toast, Toaster } from 'react-hot-toast';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

interface UIContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  showToast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    loading: (msg: string) => string;
    dismiss: (id?: string) => void;
  };
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(true);
      setConfirmState(null);
    }
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    if (confirmState) {
      confirmState.resolve(false);
      setConfirmState(null);
    }
  }, [confirmState]);

  const showToast = {
    success: (msg: string) => toast.success(msg, {
      style: {
        background: '#0a0a0a',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: '16px',
        padding: '12px 20px',
      },
      iconTheme: {
        primary: '#10b981',
        secondary: '#fff',
      }
    }),
    error: (msg: string) => toast.error(msg, {
      style: {
        background: '#0a0a0a',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: '16px',
        padding: '12px 20px',
      },
      iconTheme: {
        primary: '#ef4444',
        secondary: '#fff',
      }
    }),
    loading: (msg: string) => toast.loading(msg, {
      style: {
        background: '#0a0a0a',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: '16px',
        padding: '12px 20px',
      }
    }),
    dismiss: (id?: string) => toast.dismiss(id)
  };

  return (
    <UIContext.Provider value={{ confirm, showToast }}>
      {children}
      <Toaster position="bottom-right" reverseOrder={false} />
      {confirmState && (
        <ConfirmModal
          isOpen={confirmState.isOpen}
          title={confirmState.options.title}
          message={confirmState.options.message}
          confirmLabel={confirmState.options.confirmLabel}
          cancelLabel={confirmState.options.cancelLabel}
          isDestructive={confirmState.options.isDestructive}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
