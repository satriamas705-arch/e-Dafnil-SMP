import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  Trash2,
  X,
  Check,
  Link as LinkIcon,
  Image as ImageIcon,
  User,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  currentPhotoUrl?: string;
  userName?: string;
  userRole?: 'admin' | 'guru';
  onSavePhoto: (newPhotoUrl: string) => void;
}

/** Helper function to convert Google Drive sharing links to direct viewable image URLs */
export function processImageUrlInput(inputUrl: string): { directUrl: string; fileId: string | null; isDrive: boolean } {
  if (!inputUrl) return { directUrl: '', fileId: null, isDrive: false };
  const trimmed = inputUrl.trim();

  // If input is a raw Google Drive File ID (25-50 alphanumeric chars)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return {
      directUrl: `https://lh3.googleusercontent.com/d/${trimmed}`,
      fileId: trimmed,
      isDrive: true,
    };
  }

  // Check for google drive patterns
  const matchFileD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const matchIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const matchLh3 = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);

  const fileId = matchFileD?.[1] || matchIdParam?.[1] || matchLh3?.[1] || null;

  if (fileId) {
    return {
      directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
      fileId: fileId,
      isDrive: true,
    };
  }

  return {
    directUrl: trimmed,
    fileId: null,
    isDrive: false,
  };
}

/** Helper function to compress and resize image via canvas */
function compressImage(file: File, maxWidth = 512, maxHeight = 512, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  currentPhotoUrl = '',
  userName = 'Pengguna',
  userRole = 'admin',
  onSavePhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>(currentPhotoUrl);
  const [urlInput, setUrlInput] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentPhotoUrl || '');
      setUrlInput(currentPhotoUrl && !currentPhotoUrl.startsWith('data:') ? currentPhotoUrl : '');
      setErrorMsg(null);
      setIsProcessing(false);
    }
  }, [isOpen, currentPhotoUrl]);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format file harus berupa gambar (JPG, PNG, WEBP, GIF).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal adalah 5MB.');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);
      const compressed = await compressImage(file, 600, 600, 0.88);
      setPreviewUrl(compressed);
    } catch (err) {
      setErrorMsg('Gagal memproses gambar. Silakan coba file lain.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileChange(file);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      setErrorMsg('Masukkan URL gambar terlebih dahulu.');
      return;
    }
    const processed = processImageUrlInput(urlInput);
    setPreviewUrl(processed.directUrl);
    setErrorMsg(null);
  };

  const handleRemovePhoto = () => {
    setPreviewUrl('');
    setUrlInput('');
    setErrorMsg(null);
  };

  const handleSave = () => {
    onSavePhoto(previewUrl);
    onClose();
  };

  const getUserInitials = (name?: string): string => {
    if (!name) return userRole === 'admin' ? 'AD' : 'GR';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 sm:p-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-indigo-300">
                <Camera size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-tight">{title}</h3>
                <p className="text-xs text-indigo-200 font-medium">
                  {subtitle || `Perbarui foto identitas ${userRole === 'admin' ? 'Administrator' : 'Guru'}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Avatar Preview Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-white shadow-lg bg-slate-200 flex items-center justify-center relative group">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={userName}
                    className="w-full h-full object-cover"
                    onError={() => {
                      setErrorMsg('Gambar tidak dapat dimuat dari tautan tersebut.');
                      setPreviewUrl('');
                    }}
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center font-extrabold text-white text-2xl ${
                      userRole === 'admin'
                        ? 'bg-gradient-to-tr from-slate-800 to-indigo-900'
                        : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                    }`}
                  >
                    {getUserInitials(userName)}
                  </div>
                )}

                {isProcessing && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center text-white text-xs font-semibold">
                    Memproses...
                  </div>
                )}
              </div>

              {previewUrl && (
                <button
                  onClick={handleRemovePhoto}
                  title="Hapus foto saat ini"
                  className="absolute -top-1 -right-1 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md border-2 border-white transition transform hover:scale-110 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start space-x-2">
                <h4 className="font-bold text-slate-900 text-sm truncate max-w-[200px]">
                  {userName}
                </h4>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    userRole === 'admin'
                      ? 'bg-slate-900 text-white'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  {userRole === 'admin' ? 'Administrator' : 'Guru'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Foto akan ditampilkan pada bilah header, profil pengguna, dan laporan administrasi.
              </p>
              <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Upload size={13} />
                  <span>Pilih File Gambar</span>
                </button>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition inline-flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Hapus</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload size={14} />
              <span>Upload dari Perangkat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'url'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LinkIcon size={14} />
              <span>Link URL / Google Drive</span>
            </button>
          </div>

          {/* Tab Content: Upload File */}
          {activeTab === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
                className="hidden"
              />
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/60 bg-white'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <ImageIcon size={24} />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Klik untuk memilih file atau seret gambar ke sini
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mendukung format PNG, JPG, JPEG, WEBP (Maksimal 5MB)
                </p>
                <span className="mt-3 inline-flex items-center space-x-1 text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-full">
                  <Sparkles size={12} />
                  <span>Kompresi otomatis untuk performa optimal</span>
                </span>
              </div>
            </div>
          )}

          {/* Tab Content: Link URL / Google Drive */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tautan Gambar Langsung atau Link Google Drive:
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://... atau link sharing Google Drive"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer shrink-0"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-start space-x-2">
                <Sparkles size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Sistem otomatis mengubah format link Google Drive (<i>share link</i>) menjadi link gambar yang siap tampil.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in">
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Action Buttons */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            Batal
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition cursor-pointer inline-flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check size={15} />
              <span>Simpan Foto Profil</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
