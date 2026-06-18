import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (data: any) => Promise<void>;
  fields: {
    name: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'date' | 'datetime-local' | 'number' | 'checkbox-group';
    options?: { label: string; value: string }[];
    defaultValue?: any;
    placeholder?: string;
  }[];
  initialValues?: any;
  mode?: 'create' | 'edit' | 'view';
  children?: React.ReactNode;
  hideFooter?: boolean;
}

export default function CreateModal({ 
  isOpen, 
  onClose, 
  title, 
  onSubmit, 
  fields, 
  initialValues, 
  mode = 'create',
  children,
  hideFooter = false
}: CreateModalProps) {
 const formatFieldValue = (field: CreateModalProps['fields'][number], value: any) => {
  if (value === null || value === undefined) {
    return field.defaultValue ?? (field.type === 'checkbox-group' ? [] : '');
  }

  if (field.type === 'textarea' && typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  if (field.type === 'datetime-local' && typeof value === 'string' && value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }

  if (field.type === 'date' && typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0];
  }

  return value;
};

  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const { showToast } = useUI();

const fieldsSignature = fields.map((f) => `${f.name}:${f.type}`).join('|');

// Reset form data only when modal opens, target changes, or the field set changes
useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        const defaultValues = fields.reduce((acc, f) => ({ 
          ...acc, 
[f.name]: formatFieldValue(f, undefined)
        }), {});
        setFormData(defaultValues);
      } else {
        const initialFormValues = fields.reduce((acc, f) => ({ 
          ...acc, 
          [f.name]: formatFieldValue(f, initialValues?.[f.name]) 
        }), {});
        setFormData(initialFormValues);
      }
    } else {
      setFormData({});
    }
  }, [isOpen, mode, initialValues?.id, fieldsSignature]); // Removed raw fields and full initialValues object to prevent typing resets

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'view') {
      onClose();
      return;
    }
    
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error: any) {
      console.error('Save failed:', error);
      const message = error?.message || 'Could not save. Please try again.';
      showToast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
"relative w-full max-h-[90vh] sm:max-h-[calc(100dvh-8rem)] bg-slate-900 border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden",
              children ? "max-w-2xl" : "max-w-lg"
            )}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 sm:px-8 sm:py-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white uppercase tracking-tight">
                  {title}
                </h3>
                {mode === 'view' && !hideFooter && <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">View only</p>}
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-white/40 hover:text-white transition-colors rounded-xl hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-5 sm:space-y-6 overscroll-contain">
                {fields.map((field) => (
                  <div key={field.name} className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">
                      {field.label}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        readOnly={mode === 'view'}
                        placeholder={field.placeholder}
                        className={cn(
                          "w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none min-h-[120px] transition-all placeholder:text-white/10",
                          mode === 'view' && "opacity-60 cursor-default focus:border-white/10"
                        )}
                        value={formData[field.name] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        disabled={mode === 'view'}
                        className={cn(
                          "w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all appearance-none",
                          mode === 'view' && "opacity-60 cursor-default focus:border-white/10"
                        )}
                        value={formData[field.name] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      >
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                        ))}
                      </select>
                    ) : field.type === 'checkbox-group' ? (
  <div className="grid grid-cols-1 gap-3 p-4 bg-black/20 rounded-2xl border border-white/5 max-h-44 overflow-y-auto custom-scrollbar overscroll-contain">
    {field.options?.map((opt) => {
      const isChecked = Array.isArray(formData[field.name])
        ? formData[field.name].includes(opt.value)
        : false;

      return (
        <button
          key={opt.value}
          type="button"
          disabled={mode === 'view'}
          onClick={() => {
            if (mode === 'view') return;
            const currentValues = Array.isArray(formData[field.name]) ? formData[field.name] : [];
            const nextValues = isChecked
              ? currentValues.filter((v: string) => v !== opt.value)
              : [...currentValues, opt.value];

            setFormData({ ...formData, [field.name]: nextValues });
          }}
          className={cn(
            "flex w-full items-center gap-3 p-3 rounded-xl border transition-all text-left",
            isChecked
              ? "bg-white/10 border-white/20 text-white"
              : "bg-white/5 border-transparent text-white/40 hover:bg-white/5 hover:text-white/60",
            mode === 'view' && "cursor-default opacity-60"
          )}
        >
          <div className={cn(
            "w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all",
            isChecked ? "bg-blue-600 border-blue-500" : "bg-black/40 border-white/10"
          )}>
            {isChecked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
          </div>

          <span className="min-w-0 flex-1 text-[10px] font-bold uppercase tracking-wider truncate">
            {opt.label}
          </span>
        </button>
      );
    })}
  </div>
) : (
                      <input
                        type={field.type}
                        readOnly={mode === 'view'}
                        placeholder={field.placeholder}
                        className={cn(
                          "w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white focus:border-blue-500 outline-none transition-all placeholder:text-white/10",
                          mode === 'view' && "opacity-60 cursor-default focus:border-white/10"
                        )}
                        value={formData[field.name] ?? ''}
                        onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                      />
                    )}
                  </div>
                ))}
                
                {children && (
                  <div className="pt-6 border-t border-white/5">
                    {children}
                  </div>
                )}
              </div>
 
              {/* Footer */}
              {!hideFooter && (
                <div className="shrink-0 border-t border-white/5 bg-slate-900 p-5 sm:p-6 flex gap-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-all"
                  >
                    {mode === 'view' ? 'Close' : 'Cancel'}
                  </button>
                  {mode !== 'view' && (
                    <button
                      type="submit"
                      disabled={loading}
                      className={cn(
                        "flex-1 py-4 rounded-2xl bg-white text-slate-950 font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/5 flex items-center justify-center gap-2",
                        loading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <>
                          {mode === 'create' ? 'Create' : 'Update'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
