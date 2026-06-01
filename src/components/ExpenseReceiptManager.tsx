import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ExpenseReceipt } from '../types';
import { Upload, Trash2, Eye, FileText, Loader2 } from 'lucide-react';
import { useUI } from '../contexts/UIContext';

interface ExpenseReceiptManagerProps {
  expenseId: string;
  userId: string;
  onReceiptUploaded?: () => void;
}

export default function ExpenseReceiptManager({ expenseId, userId, onReceiptUploaded }: ExpenseReceiptManagerProps) {
  const { showToast, confirm } = useUI();
  const [receipts, setReceipts] = useState<ExpenseReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReceipts = async () => {
    if (!expenseId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expense_receipts')
        .select('*')
        .eq('expense_id', expenseId);
        
      if (error) throw error;
      setReceipts(data || []);
    } catch (err: any) {
      console.error('Failed to load receipts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [expenseId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !expenseId) return;

    setUploading(true);
    const toastId = showToast.loading(`Uploading ${file.name}...`);

    try {
      const fileExt = file.name.split('.').pop();
      const uniqueId = crypto.randomUUID();
      const fileIdName = `${uniqueId}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${userId}/${expenseId}/${fileIdName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(uploadError.message || 'Storage uploading failed. Make sure the "expense-receipts" storage bucket exists in Supabase.');
      }

      // 2. Create receipt metadata in DB
      const { error: dbError } = await supabase
        .from('expense_receipts')
        .insert({
          user_id: userId,
          expense_id: expenseId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          created_at: new Date().toISOString()
        });

      if (dbError) {
        // Rollback storage file
        await supabase.storage.from('expense-receipts').remove([filePath]);
        throw dbError;
      }

      showToast.dismiss(toastId);
      showToast.success('Receipt uploaded successfully');
      fetchReceipts();
      if (onReceiptUploaded) onReceiptUploaded();
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleViewReceipt = async (receipt: ExpenseReceipt) => {
    try {
      const { data, error } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(receipt.file_path, 300); // 5 min expiry

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      showToast.error('Failed to generate view link: ' + err.message);
    }
  };

  const handleDeleteReceipt = async (receipt: ExpenseReceipt) => {
    const isConfirmed = await confirm({
      title: 'Delete Receipt File',
      message: `Delete ${receipt.file_name}? This action cannot be undone.`,
      confirmLabel: 'Delete File',
      isDestructive: true
    });

    if (!isConfirmed) return;

    const toastId = showToast.loading(`Deleting ${receipt.file_name}...`);
    try {
      // 1. Delete from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('expense-receipts')
        .remove([receipt.file_path]);

      if (storageError) {
        console.warn('Storage file deletion warning (continuing to clear DB):', storageError);
      }

      // 2. Delete from Metadata DB table
      const { error: dbError } = await supabase
        .from('expense_receipts')
        .delete()
        .eq('id', receipt.id);

      if (dbError) throw dbError;

      showToast.dismiss(toastId);
      showToast.success('Receipt deleted successfully');
      fetchReceipts();
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error('Deletion failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[10px] font-black uppercase text-purple-400 tracking-[0.2em]">Receipts & Invoices</h4>
          <p className="text-[9px] text-white/30 uppercase mt-0.5">Upload receipt image or PDF files securely</p>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept="image/*,application/pdf"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
          >
            {uploading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            Upload Receipt
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-4 bg-black/20 rounded-2xl border border-white/5">
          <Loader2 size={16} className="text-purple-400 animate-spin" />
        </div>
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 bg-black/20 rounded-2xl border border-white/5 text-center">
          <FileText size={20} className="text-white/10 mb-2" />
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">No receipt files uploaded yet</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {receipts.map(receipt => (
            <div key={receipt.id} className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl">
                  <FileText size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate max-w-xs">{receipt.file_name}</p>
                  <p className="text-[9px] text-white/40 uppercase tracking-tighter">
                    {(receipt.file_size / 1024).toFixed(1)} KB • {receipt.mime_type.split('/').pop()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleViewReceipt(receipt)}
                  className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  title="View / Download"
                >
                  <Eye size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteReceipt(receipt)}
                  className="p-2 rounded-xl text-red-500/30 hover:text-red-500 hover:bg-red-500/5 transition-all"
                  title="Delete File"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
