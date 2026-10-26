import React, { useState, useRef } from 'react';
import { AppState, Guru, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { ExcelGuruModal } from './ExcelGuruModal';
import { PhotoUploadModal, processImageUrlInput } from '../common/PhotoUploadModal';
import {
  UserCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Phone,
  Mail,
  Filter,
  BookOpen,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  FileSpreadsheet,
  AlertTriangle,
  KeyRound,
  RotateCcw,
  Check,
  Copy,
  ShieldCheck,
  Camera,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

interface DataGuruProps {
  appState: AppState;
  onUpdateGuruList: (newList: Guru[], notif: NotificationLog) => void;
}

export const DataGuru: React.FC<DataGuruProps> = ({ appState, onUpdateGuruList }) => {
  const [search, setSearch] = useState('');
  const [filterKelasId, setFilterKelasId] = useState<string>('ALL');
  const [filterMapelId, setFilterMapelId] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [editingGuru, setEditingGuru] = useState<Guru | null>(null);
  const [showPhotoModalGuru, setShowPhotoModalGuru] = useState<Guru | null>(null);
  const [guruForResetPassword, setGuruForResetPassword] = useState<Guru | null>(null);
  const [resetSuccessData, setResetSuccessData] = useState<{
    guru: Guru;
    username: string;
    defaultPass: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  const handleConfirmResetPassword = () => {
    if (!guruForResetPassword) return;
    const g = guruForResetPassword;
    const username = g.nip || g.nama.toLowerCase().split(' ')[0];
    const defaultPass = 'guru123456';

    const notif = createNotification(
      'Reset Password Guru',
      `Password akun guru ${g.nama} (${g.nip || 'Non-NIP'}) telah direset ke password standar: ${defaultPass}.`,
      'data-guru'
    );
    onUpdateGuruList(appState.guruList, notif);
    setGuruForResetPassword(null);
    setResetSuccessData({ guru: g, username, defaultPass });
  };

  const handleCopyCredentials = () => {
    if (!resetSuccessData) return;
    const text = `Akun Guru SIMPEGUR:\nNama: ${resetSuccessData.guru.nama}\nUsername: ${resetSuccessData.username}\nPassword: ${resetSuccessData.defaultPass}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteAll = () => {
    const total = appState.guruList.length;
    const notif = createNotification(
      'Hapus Semua Data Guru',
      `Seluruh data guru (${total} guru) telah dihapus dari sistem.`,
      'data-guru'
    );
    onUpdateGuruList([], notif);
    setShowDeleteAllConfirm(false);
  };

  // Form State
  const [form, setForm] = useState<Omit<Guru, 'id'>>({
    nip: '',
    nama: '',
    jenisKelamin: 'L',
    email: '',
    noHp: '',
    fotoUrl: '',
    mapelAmpuanIds: [],
    kelasAmpuanIds: [],
  });

  const handleOpenAdd = () => {
    setEditingGuru(null);
    setForm({
      nip: '',
      nama: '',
      jenisKelamin: 'L',
      email: '',
      noHp: '',
      fotoUrl: '',
      mapelAmpuanIds: appState.mapelList[0] ? [appState.mapelList[0].id] : [],
      kelasAmpuanIds: appState.kelasList[0] ? [appState.kelasList[0].id] : [],
    });
    setShowModal(true);
  };

  const handleOpenEdit = (g: Guru) => {
    setEditingGuru(g);
    setForm({
      nip: g.nip,
      nama: g.nama,
      jenisKelamin: g.jenisKelamin,
      email: g.email,
      noHp: g.noHp,
      fotoUrl: g.fotoUrl || '',
      mapelAmpuanIds: g.mapelAmpuanIds || [],
      kelasAmpuanIds: g.kelasAmpuanIds || [],
    });
    setShowModal(true);
  };

  const handleModalPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file maksimal 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const maxWidth = 512;
        const maxHeight = 512;
        let width = img.width;
        let height = img.height;
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
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setForm((prev) => ({ ...prev, fotoUrl: compressed }));
        } else {
          setForm((prev) => ({ ...prev, fotoUrl: event.target?.result as string }));
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleQuickSaveGuruPhoto = (guruId: string, newPhotoUrl: string) => {
    const updated = appState.guruList.map((g) =>
      g.id === guruId ? { ...g, fotoUrl: newPhotoUrl } : g
    );
    const targetGuru = appState.guruList.find((g) => g.id === guruId);
    const notif = createNotification(
      'Foto Profil Guru Diperbarui',
      newPhotoUrl
        ? `Foto profil guru ${targetGuru?.nama || ''} berhasil diperbarui.`
        : `Foto profil guru ${targetGuru?.nama || ''} telah dihapus.`,
      'data-guru'
    );
    onUpdateGuruList(updated, notif);
    setShowPhotoModalGuru(null);
  };

  const getGuruInitials = (name?: string): string => {
    if (!name) return 'GR';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleDelete = (g: Guru) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data guru ${g.nama}?`)) {
      const updated = appState.guruList.filter((item) => item.id !== g.id);
      const notif = createNotification(
        'Hapus Data Guru',
        `Data guru ${g.nama} (${g.nip}) berhasil dihapus.`,
        'data-guru'
      );
      onUpdateGuruList(updated, notif);
    }
  };

  const toggleMapelSelection = (mapelId: string) => {
    setForm((prev) => {
      const exists = prev.mapelAmpuanIds.includes(mapelId);
      if (exists) {
        return {
          ...prev,
          mapelAmpuanIds: prev.mapelAmpuanIds.filter((id) => id !== mapelId),
        };
      } else {
        return {
          ...prev,
          mapelAmpuanIds: [...prev.mapelAmpuanIds, mapelId],
        };
      }
    });
  };

  const toggleKelasSelection = (kelasId: string) => {
    setForm((prev) => {
      const exists = prev.kelasAmpuanIds.includes(kelasId);
      if (exists) {
        return {
          ...prev,
          kelasAmpuanIds: prev.kelasAmpuanIds.filter((id) => id !== kelasId),
        };
      } else {
        return {
          ...prev,
          kelasAmpuanIds: [...prev.kelasAmpuanIds, kelasId],
        };
      }
    });
  };

  const selectAllMapel = () => {
    setForm((prev) => ({
      ...prev,
      mapelAmpuanIds: appState.mapelList.map((m) => m.id),
    }));
  };

  const clearAllMapel = () => {
    setForm((prev) => ({
      ...prev,
      mapelAmpuanIds: [],
    }));
  };

  const selectAllKelas = () => {
    setForm((prev) => ({
      ...prev,
      kelasAmpuanIds: appState.kelasList.map((k) => k.id),
    }));
  };

  const clearAllKelas = () => {
    setForm((prev) => ({
      ...prev,
      kelasAmpuanIds: [],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama || !form.nip) {
      alert('NIP dan Nama Guru wajib diisi!');
      return;
    }

    if (form.mapelAmpuanIds.length === 0) {
      alert('Pilih minimal satu Mata Pelajaran Ampuan!');
      return;
    }

    if (form.kelasAmpuanIds.length === 0) {
      alert('Pilih minimal satu Kelas Ampuan!');
      return;
    }

    if (editingGuru) {
      const updated = appState.guruList.map((item) =>
        item.id === editingGuru.id ? { ...editingGuru, ...form } : item
      );
      const notif = createNotification(
        'Pembaruan Data Guru',
        `Data guru ${form.nama} (${form.nip}) berhasil diperbarui.`,
        'data-guru'
      );
      onUpdateGuruList(updated, notif);
    } else {
      const newGuru: Guru = {
        id: 'g-' + Date.now(),
        ...form,
      };
      const updated = [...appState.guruList, newGuru];
      const notif = createNotification(
        'Penambahan Data Guru',
        `Guru baru ${form.nama} (${form.nip}) berhasil ditambahkan.`,
        'data-guru'
      );
      onUpdateGuruList(updated, notif);
    }
    setShowModal(false);
  };

  // Filter & Search Logic
  const filteredGuru = appState.guruList.filter((g) => {
    const query = search.toLowerCase();

    // Get mapel names & codes
    const mapelNames = (g.mapelAmpuanIds || [])
      .map((mId) => {
        const m = appState.mapelList.find((item) => item.id === mId);
        return m ? `${m.namaMapel} ${m.kodeMapel}`.toLowerCase() : '';
      })
      .join(' ');

    // Get kelas codes & names
    const kelasNames = (g.kelasAmpuanIds || [])
      .map((kId) => {
        const k = appState.kelasList.find((item) => item.id === kId);
        return k ? `${k.namaKelas} ${k.kodeKelas}`.toLowerCase() : '';
      })
      .join(' ');

    const matchSearch =
      g.nama.toLowerCase().includes(query) ||
      g.nip.includes(query) ||
      g.email.toLowerCase().includes(query) ||
      mapelNames.includes(query) ||
      kelasNames.includes(query);

    const matchKelas =
      filterKelasId === 'ALL' || (g.kelasAmpuanIds || []).includes(filterKelasId);

    const matchMapel =
      filterMapelId === 'ALL' || (g.mapelAmpuanIds || []).includes(filterMapelId);

    return matchSearch && matchKelas && matchMapel;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <UserCheck className="text-blue-600" size={24} />
            <span>Manajemen Data Guru</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data pendidik, NIP, beberapa kelas ampuan, serta beberapa mata pelajaran ampuan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowExcelModal(true)}
            className="px-4 py-2.5 bg-[#107c41] hover:bg-[#0b6233] text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer border border-emerald-600"
          >
            <FileSpreadsheet size={16} />
            <span>Export / Import Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>Tambah Data Guru</span>
          </button>

          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={appState.guruList.length === 0}
            className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Hapus seluruh data guru di sistem"
          >
            <Trash2 size={15} />
            <span>Hapus Semua Data</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NIP, mapel, atau kelas..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1 text-xs">
            <Filter size={14} className="text-slate-400" />
            <span className="font-semibold text-slate-600">Filter Kelas:</span>
            <select
              value={filterKelasId}
              onChange={(e) => setFilterKelasId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden"
            >
              <option value="ALL">Semua Kelas Ampuan</option>
              {appState.kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.namaKelas} ({k.kodeKelas})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1 text-xs">
            <span className="font-semibold text-slate-600">Filter Mapel:</span>
            <select
              value={filterMapelId}
              onChange={(e) => setFilterMapelId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden"
            >
              <option value="ALL">Semua Mapel Ampuan</option>
              {appState.mapelList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.namaMapel}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-12 text-center">No</th>
                <th className="p-3.5 min-w-[160px]">Identitas Guru</th>
                <th className="p-3.5 min-w-[140px]">NIP</th>
                <th className="p-3.5 min-w-[200px]">Mapel Ampuan</th>
                <th className="p-3.5 min-w-[180px]">Kelas Ampuan</th>
                <th className="p-3.5 min-w-[180px]">Kontak</th>
                <th className="p-3.5 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGuru.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Tidak ada data guru yang ditemukan dengan kriteria filter tersebut.
                  </td>
                </tr>
              ) : (
                filteredGuru.map((g, idx) => {
                  const mapelListAmpuan = (g.mapelAmpuanIds || []).map((mId) =>
                    appState.mapelList.find((m) => m.id === mId)
                  ).filter(Boolean);

                  const kelasListAmpuan = (g.kelasAmpuanIds || []).map((kId) =>
                    appState.kelasList.find((k) => k.id === kId)
                  ).filter(Boolean);

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-3">
                          <div
                            onClick={() => setShowPhotoModalGuru(g)}
                            title="Klik untuk ubah foto guru"
                            className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-white text-xs cursor-pointer shadow-xs group relative hover:ring-2 hover:ring-indigo-500/50 transition"
                          >
                            {g.fotoUrl ? (
                              <img
                                src={g.fotoUrl}
                                alt={g.nama}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span
                                className={`w-full h-full flex items-center justify-center font-bold ${
                                  g.jenisKelamin === 'P'
                                    ? 'bg-pink-600'
                                    : 'bg-indigo-600'
                                }`}
                              >
                                {getGuruInitials(g.nama)}
                              </span>
                            )}
                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                              <Camera size={13} className="text-white" />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-sm truncate max-w-[180px]">
                              {g.nama}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                              <span
                                className={`w-1.5 h-1.5 rounded-full inline-block ${
                                  g.jenisKelamin === 'P' ? 'bg-pink-500' : 'bg-blue-500'
                                }`}
                              />
                              <span>{g.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-700">{g.nip || '-'}</td>
                      
                      {/* Multiple Mapel Ampuan */}
                      <td className="p-3.5">
                        {mapelListAmpuan.length === 0 ? (
                          <span className="text-slate-400 text-[11px] italic">Belum ditentukan</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {mapelListAmpuan.map((m) => (
                              <span
                                key={m!.id}
                                className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold text-[11px] inline-flex items-center space-x-1"
                              >
                                <BookOpen size={10} className="shrink-0" />
                                <span>{m!.namaMapel}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Multiple Kelas Ampuan */}
                      <td className="p-3.5">
                        {kelasListAmpuan.length === 0 ? (
                          <span className="text-slate-400 text-[11px] italic">Belum ditentukan</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {kelasListAmpuan.map((k) => (
                              <span
                                key={k!.id}
                                className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-extrabold text-[11px] inline-flex items-center space-x-1"
                              >
                                <Users size={10} className="shrink-0" />
                                <span>{k!.kodeKelas}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Kontak */}
                      <td className="p-3.5 text-slate-600 space-y-0.5">
                        {g.email && (
                          <div className="flex items-center space-x-1 text-[11px]">
                            <Mail size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{g.email}</span>
                          </div>
                        )}
                        {g.noHp && (
                          <div className="flex items-center space-x-1 text-[11px]">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            <span>{g.noHp}</span>
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => setShowPhotoModalGuru(g)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Upload / Ganti Foto Guru"
                          >
                            <Camera size={15} />
                          </button>
                          <button
                            onClick={() => setGuruForResetPassword(g)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="Reset Password Akun Guru"
                          >
                            <KeyRound size={15} />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(g)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Guru"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(g)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Data Guru"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Tambah / Edit Guru */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <UserCheck size={18} className="text-blue-600" />
                <span>{editingGuru ? 'Edit Data Guru' : 'Tambah Data Guru Baru'}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              {/* Foto Profil Guru Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-3.5">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md bg-slate-200 flex items-center justify-center">
                    {form.fotoUrl ? (
                      <img src={form.fotoUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                    ) : (
                      <span className={`w-full h-full flex items-center justify-center font-bold text-base text-white ${form.jenisKelamin === 'P' ? 'bg-pink-500' : 'bg-blue-600'}`}>
                        {getGuruInitials(form.nama)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => modalFileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 transition cursor-pointer"
                    title="Unggah Foto"
                  >
                    <Camera size={12} />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className="font-bold text-slate-800 text-sm">Foto Profil Guru</div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Format JPG, PNG, atau WebP. Otomatis dikompresi untuk kinerja optimal.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <input
                      ref={modalFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleModalPhotoUpload}
                    />
                    <button
                      type="button"
                      onClick={() => modalFileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-lg font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition"
                    >
                      <Upload size={12} />
                      <span>{form.fotoUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
                    </button>
                    {form.fotoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, fotoUrl: '' }))}
                        className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-bold text-xs cursor-pointer transition"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 1: NIP & Jenis Kelamin */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">NIP Guru</label>
                  <input
                    type="text"
                    value={form.nip}
                    onChange={(e) => setForm({ ...form, nip: e.target.value })}
                    placeholder="Contoh: 198203152009021005"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={form.jenisKelamin}
                    onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value as 'L' | 'P' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Nama Lengkap */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap Guru
                </label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  placeholder="Contoh: Ahmad Fauzi"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              {/* Multiple Mata Pelajaran Ampuan */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <BookOpen size={15} className="text-blue-600" />
                    <span>Mata Pelajaran Ampuan (Bisa Pilih Lebih Dari Satu)</span>
                  </label>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllMapel}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={clearAllMapel}
                      className="text-slate-500 hover:text-rose-600 font-medium cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-40 overflow-y-auto pr-1">
                  {appState.mapelList.map((m) => {
                    const isSelected = form.mapelAmpuanIds.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => toggleMapelSelection(m.id)}
                        className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate pr-2">{m.namaMapel} ({m.kodeMapel})</span>
                        {isSelected ? (
                          <CheckSquare size={16} className="text-blue-600 shrink-0" />
                        ) : (
                          <Square size={16} className="text-slate-300 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  Terpilih: {form.mapelAmpuanIds.length} Mata Pelajaran
                </p>
              </div>

              {/* Multiple Kelas Ampuan */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Users size={15} className="text-emerald-600" />
                    <span>Kelas Ampuan (Bisa Pilih Lebih Dari Satu)</span>
                  </label>
                  <div className="flex items-center space-x-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllKelas}
                      className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={clearAllKelas}
                      className="text-slate-500 hover:text-rose-600 font-medium cursor-pointer"
                    >
                      Bersihkan
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-40 overflow-y-auto pr-1">
                  {appState.kelasList.map((k) => {
                    const isSelected = form.kelasAmpuanIds.includes(k.id);
                    return (
                      <button
                        type="button"
                        key={k.id}
                        onClick={() => toggleKelasSelection(k.id)}
                        className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{k.namaKelas}</span>
                        {isSelected ? (
                          <CheckSquare size={16} className="text-emerald-600 shrink-0" />
                        ) : (
                          <Square size={16} className="text-slate-300 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-500 italic">
                  Terpilih: {form.kelasAmpuanIds.length} Kelas Rombel
                </p>
              </div>

              {/* Row 3: Kontak (Email & No HP) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="nama@sekolah.sch.id"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No HP/WhatsApp</label>
                  <input
                    type="text"
                    value={form.noHp}
                    onChange={(e) => setForm({ ...form, noHp: e.target.value })}
                    placeholder="0812xxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Simpan Data Guru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import & Export MS Excel */}
      {showExcelModal && (
        <ExcelGuruModal
          appState={appState}
          onClose={() => setShowExcelModal(false)}
          onUpdateGuruList={onUpdateGuruList}
        />
      )}

      {/* Confirmation Modal Hapus Semua Data Guru */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl shrink-0">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Semua Data Guru</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin <strong>MENGHAPUS SELURUH DATA GURU</strong> ({appState.guruList.length} guru)?
                </p>
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold">
                  ⚠️ Peringatan: Tindakan ini akan mengosongkan seluruh daftar pendidik dari database sistem dan tidak dapat dikembalikan!
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Ya, Hapus Semua Data Guru
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Reset Password */}
      {guruForResetPassword && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3.5">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                <KeyRound size={26} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset Password Guru</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Kembalikan password akun guru ini ke kata sandi bawaan sistem.
                </p>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Nama Guru:</span>
                <span className="font-bold text-slate-800">{guruForResetPassword.nama}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">NIP / ID:</span>
                <span className="font-mono font-bold text-slate-800">{guruForResetPassword.nip || '-'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Username Login:</span>
                <span className="font-mono font-bold text-blue-700">
                  {guruForResetPassword.nip || guruForResetPassword.nama.toLowerCase().split(' ')[0]}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Password Baru:</span>
                <span className="font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                  guru123456
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                onClick={() => setGuruForResetPassword(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmResetPassword}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-extrabold shadow-md shadow-amber-500/20 cursor-pointer flex items-center space-x-1.5"
              >
                <RotateCcw size={14} />
                <span>Reset Password Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sukses Reset Password */}
      {resetSuccessData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Password Berhasil Direset!</h3>
              <p className="text-xs text-slate-600 mt-1">
                Password untuk <strong className="text-slate-900">{resetSuccessData.guru.nama}</strong> telah berhasil diatur ulang.
              </p>
            </div>

            <div className="mt-5 p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Username Login:</span>
                <span className="font-mono font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-200">
                  {resetSuccessData.username}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Password Baru:</span>
                <span className="font-mono font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                  {resetSuccessData.defaultPass}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopyCredentials}
                className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer transition"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Akun Guru'}</span>
              </button>
              <button
                onClick={() => setResetSuccessData(null)}
                className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Upload Foto Guru Langsung */}
      {showPhotoModalGuru && (
        <PhotoUploadModal
          isOpen={true}
          onClose={() => setShowPhotoModalGuru(null)}
          onSave={(newUrl) => handleQuickSaveGuruPhoto(showPhotoModalGuru.id, newUrl)}
          currentPhotoUrl={showPhotoModalGuru.fotoUrl}
          title={`Upload Foto Profil - ${showPhotoModalGuru.nama}`}
          description={`Pilih foto profil resmi untuk ${showPhotoModalGuru.nama} (NIP: ${showPhotoModalGuru.nip || '-'}).`}
        />
      )}
    </div>
  );
};
