import React, { useState, useRef } from 'react';
import { 
  File, 
  Upload, 
  Trash2, 
  Download, 
  ExternalLink, 
  MoreVertical,
  Paperclip,
  Activity,
  AlertCircle,
  Loader2,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useSupabaseQuery } from '../hooks/useData';
import { Project, ProjectFile, ProjectItem } from '../types';
import { cn } from '../lib/utils';
import { useUI } from '../contexts/UIContext';
import { useUser } from '../hooks/useUser';

interface ProjectFilesProps {
  project: Project;
  onUpdate?: () => void;
  uploadSignal?: string | number;
  onActionConsumed?: () => void;
}

export default function ProjectFiles({ project, onUpdate, uploadSignal, onActionConsumed }: ProjectFilesProps) {
  const { user } = useUser();
  const { confirm, showToast } = useUI();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedItemForUpload, setSelectedItemForUpload] = useState<string | null>(null);

  // Handle uploadSignal
  React.useEffect(() => {
    if (uploadSignal && fileInputRef.current) {
      fileInputRef.current.click();
      if (onActionConsumed) onActionConsumed();
    }
  }, [uploadSignal]);

  const { data: files, refetch, loading } = useSupabaseQuery<ProjectFile[]>(
    () => supabase.from('project_files').select('*, project_item:project_items(name)').eq('project_id', project.id).order('created_at', { ascending: false }),
    [project.id]
  );

  const { data: items } = useSupabaseQuery<ProjectItem[]>(
    () => supabase.from('project_items').select('id, name').eq('project_id', project.id),
    [project.id]
  );

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const toastId = showToast.loading(`Uploading ${file.name}...`);

    try {
      const fileExt = file.name.split('.').pop();
      const fileId = crypto.randomUUID();
      const fileName = `${fileId}-${file.name}`;
      const filePath = `${user.id}/${project.id}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Create metadata record
      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          user_id: user.id,
          project_id: project.id,
          project_item_id: selectedItemForUpload || null,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_size: file.size,
          file_path: filePath,
          tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        // Rollback storage if DB fails
        await supabase.storage.from('project-files').remove([filePath]);
        throw dbError;
      }

      showToast.dismiss(toastId);
      showToast.success('File uploaded successfully');
      refetch();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast.dismiss(toastId);
      showToast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (file: ProjectFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .createSignedUrl(file.file_path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      showToast.error('Download failed: ' + err.message);
    }
  };

  const handleDelete = async (file: ProjectFile) => {
    const isConfirmed = await confirm({
      title: 'Delete File',
      message: `Are you sure you want to delete "${file.file_name}"? This action cannot be undone.`,
      confirmLabel: 'Delete File',
      isDestructive: true
    });

    if (!isConfirmed) return;

    try {
    // 1. Delete DB record first so the UI never keeps a broken file row
const { error: dbError } = await supabase
  .from('project_files')
  .delete()
  .eq('id', file.id);

if (dbError) throw dbError;

// 2. Then remove the storage object
const { error: storageError } = await supabase.storage
  .from('project-files')
  .remove([file.file_path]);

if (storageError) {
  console.warn('Storage file cleanup failed:', storageError);
}

      showToast.success('File deleted');
      refetch();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showToast.error('Delete failed: ' + err.message);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-widest">Project Files</h4>
          <p className="text-[10px] text-white/30 uppercase font-bold tracking-tighter mt-1">Stored securely in Supabase Storage</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={selectedItemForUpload || ''} 
            onChange={(e) => setSelectedItemForUpload(e.target.value || null)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white/60 focus:border-blue-500 outline-none uppercase tracking-widest"
          >
            <option value="">Project Root</option>
            {items?.map(item => (
              <option key={item.id} value={item.id}>Item: {item.name}</option>
            ))}
          </select>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-slate-950 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-white/10 hover:bg-white/90 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload File
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/5 rounded-[2rem] overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <Loader2 className="animate-spin text-white/20" size={32} />
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Loading files...</p>
          </div>
        ) : files?.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/10">
              <File size={32} />
            </div>
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">No project files yet</p>
              <p className="text-[9px] text-white/20 mt-1 uppercase font-bold tracking-widest">Upload relevant documents or assets</p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop View Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black text-white/20 uppercase tracking-widest">Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-white/20 uppercase tracking-widest">Size</th>
                    <th className="px-6 py-4 text-[10px] font-black text-white/20 uppercase tracking-widest">Linked Item</th>
                    <th className="px-6 py-4 text-[10px] font-black text-white/20 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {files?.map(file => (
                    <tr key={file.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                            <File size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white line-clamp-1">{file.file_name}</p>
                            <p className="text-[9px] text-white/20 font-black uppercase tracking-widest truncate max-w-[150px]">{file.file_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-white/40 uppercase">{formatFileSize(file.file_size)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 w-fit">
                          <Paperclip size={8} className={cn(file.project_item_id ? "text-blue-400" : "text-white/20")} />
                          <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">
                            {(file as any).project_item?.name || 'Project Root'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-bold text-white/40 uppercase">
                          {new Date(file.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleDownload(file)}
                            className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                            title="Download / Open"
                          >
                            <Download size={14} />
                          </button>
                          <button 
                            onClick={() => handleDelete(file)}
                            className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View Cards */}
            <div className="block md:hidden divide-y divide-white/5">
              {files?.map(file => (
                <div key={file.id} className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                        <File size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">{file.file_name}</p>
                        <p className="text-[10px] text-white/30 font-black uppercase tracking-wider">{formatFileSize(file.file_size)} • {file.file_type || 'unspecified'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => handleDownload(file)}
                        className="p-2.5 text-white/50 hover:text-white bg-white/5 rounded-xl transition-all"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(file)}
                        className="p-2.5 text-white/50 hover:text-red-400 bg-white/5 rounded-xl transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/5">
                      <Paperclip size={10} className={cn(file.project_item_id ? "text-blue-400" : "text-white/20")} />
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] truncate max-w-[120px]">
                        {(file as any).project_item?.name || 'Project Root'}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-white/30 uppercase">
                      {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
