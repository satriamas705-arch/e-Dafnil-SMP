import React, { useState } from 'react';
import { AppState, Kelas, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { ExcelKelasModal } from './ExcelKelasModal';
import { Users, Plus, Edit2, Trash2, X, Search, GraduationCap, User, FileSpreadsheet, AlertTriangle } from 'lucide-react';

interface DataKelasProps {
  appState: AppState;
  onUpdateKelasList: (newList: Kelas[], notif: NotificationLog) => void;
}

export const DataKelas: React.FC<DataKelasProps> = ({ appState, onUpdateKelasList }) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [editingKelas, setEditingKelas] = useState<Kelas | null>(null);

  const handleDeleteAll = () => {
    const total = appState.kelasList.length;
    const notif = createNotification(
      'Hapus Semua Data Kelas',
      `Seluruh data kelas (${total} kelas) telah dihapus dari sistem.`,
      'data-kelas'
    );
    onUpdateKelasList([], notif);
    setShowDeleteAllConfirm(false);
  };

  const [form, setForm] = useState<Omit<Kelas, 'id' | 'waliKelasNama'>>({
    kodeKelas: '',
    namaKelas: '',
    tingkat: 7,
    waliKelasId: appState.guruList[0]?.id || '',
    tahunAjaran: '2025/2026',
  });

  const handleOpenAdd = () => {
    setEditingKelas(null);
    setForm({
      kodeKelas: '',
      namaKelas: '',
      tingkat: 7,
      waliKelasId: appState.guruList[0]?.id || '',
      tahunAjaran: '2025/2026',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (k: Kelas) => {
    setEditingKelas(k);
    setForm({
      kodeKelas: k.kodeKelas,
      namaKelas: k.namaKelas,
      tingkat: k.tingkat,
      waliKelasId: k.waliKelasId,
      tahunAjaran: k.tahunAjaran,
    });
    setShowModal(true);
  };

  const handleDelete = (k: Kelas) => {
    if (confirm(`Apakah Anda yakin ingin menghapus kelas ${k.namaKelas}?`)) {
      const updated = appState.kelasList.filter((item) => item.id !== k.id);
      const notif = createNotification(
        'Hapus Data Kelas',
        `Data kelas ${k.namaKelas} berhasil dihapus.`,
        'data-kelas'
      );
      onUpdateKelasList(updated, notif);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kodeKelas || !form.namaKelas) {
      alert('Kode Kelas dan Nama Kelas wajib diisi!');
      return;
    }

    const waliGuru = appState.guruList.find((g) => g.id === form.waliKelasId);
    const waliNama = waliGuru ? waliGuru.nama : 'Belum Ditentukan';

    if (editingKelas) {
      const updated = appState.kelasList.map((item) =>
        item.id === editingKelas.id
          ? { ...editingKelas, ...form, waliKelasNama: waliNama }
          : item
      );
      const notif = createNotification(
        'Pembaruan Data Kelas',
        `Data kelas ${form.namaKelas} (Wali Kelas: ${waliNama}) diperbarui.`,
        'data-kelas'
      );
      onUpdateKelasList(updated, notif);
    } else {
      const newKelas: Kelas = {
        id: 'k-' + Date.now(),
        ...form,
        waliKelasNama: waliNama,
      };
      const updated = [...appState.kelasList, newKelas];
      const notif = createNotification(
        'Penambahan Data Kelas',
        `Kelas baru ${form.namaKelas} berhasil ditambahkan.`,
        'data-kelas'
      );
      onUpdateKelasList(updated, notif);
    }
    setShowModal(false);
  };

  const filteredKelas = appState.kelasList.filter(
    (k) =>
      k.namaKelas.toLowerCase().includes(search.toLowerCase()) ||
      k.kodeKelas.toLowerCase().includes(search.toLowerCase()) ||
      k.waliKelasNama.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <Users className="text-blue-600" size={24} />
            <span>Manajemen Data Kelas</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola rombongan belajar, penugasan Wali Kelas, dan alokasi siswa per kelas.
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
            <span>Tambah Data Kelas</span>
          </button>

          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={appState.kelasList.length === 0}
            className="px-3 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Hapus seluruh data kelas di sistem"
          >
            <Trash2 size={15} />
            <span>Hapus Semua Data</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama kelas atau wali kelas..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Kelas Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredKelas.map((k) => {
          const studentCount = appState.siswaList.filter((s) => s.kelasId === k.id).length;
          return (
            <div
              key={k.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 font-black text-lg flex items-center justify-center shrink-0">
                    {k.kodeKelas}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{k.namaKelas}</h3>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-full">
                      Tingkat {k.tingkat}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(k)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit Kelas"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(k)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="Hapus Kelas"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center space-x-1 text-slate-400">
                    <User size={14} />
                    <span>Wali Kelas:</span>
                  </span>
                  <span className="font-bold text-slate-900 truncate max-w-[180px]">
                    {k.waliKelasNama}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center space-x-1 text-slate-400">
                    <GraduationCap size={14} />
                    <span>Jumlah Siswa:</span>
                  </span>
                  <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {studentCount} Siswa
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Form Tambah/Edit Kelas */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingKelas ? 'Edit Data Kelas' : 'Tambah Data Kelas Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode Kelas</label>
                  <input
                    type="text"
                    value={form.kodeKelas}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        kodeKelas: e.target.value.toUpperCase(),
                        namaKelas: `Kelas ${e.target.value.toUpperCase()}`,
                      })
                    }
                    placeholder="Contoh: 7A, 9B"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tingkat</label>
                  <select
                    value={form.tingkat}
                    onChange={(e) => setForm({ ...form, tingkat: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value={7}>Tingkat 7 (Kelas VII)</option>
                    <option value={8}>Tingkat 8 (Kelas VIII)</option>
                    <option value={9}>Tingkat 9 (Kelas IX)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Kelas</label>
                <input
                  type="text"
                  value={form.namaKelas}
                  onChange={(e) => setForm({ ...form, namaKelas: e.target.value })}
                  placeholder="Contoh: Kelas 7A"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Wali Kelas</label>
                <select
                  value={form.waliKelasId}
                  onChange={(e) => setForm({ ...form, waliKelasId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                >
                  {appState.guruList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} ({g.nip})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 font-bold text-white shadow-md shadow-blue-500/20"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Import & Export MS Excel */}
      {showExcelModal && (
        <ExcelKelasModal
          appState={appState}
          onClose={() => setShowExcelModal(false)}
          onUpdateKelasList={onUpdateKelasList}
        />
      )}

      {/* Confirmation Modal Hapus Semua Data Kelas */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl shrink-0">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Semua Data Kelas</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin <strong>MENGHAPUS SELURUH DATA KELAS</strong> ({appState.kelasList.length} kelas)?
                </p>
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold">
                  ⚠️ Peringatan: Tindakan ini akan mengosongkan seluruh daftar rombongan belajar dari database sistem dan tidak dapat dikembalikan!
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
                Ya, Hapus Semua Data Kelas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
