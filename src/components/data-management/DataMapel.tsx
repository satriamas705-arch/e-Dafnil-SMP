import React, { useState } from 'react';
import { AppState, Mapel, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { ExcelMapelModal } from './ExcelMapelModal';
import { BookOpen, Plus, Edit2, Trash2, X, Search, FileSpreadsheet, AlertTriangle } from 'lucide-react';

interface DataMapelProps {
  appState: AppState;
  onUpdateMapelList: (newList: Mapel[], notif: NotificationLog) => void;
}

export const DataMapel: React.FC<DataMapelProps> = ({ appState, onUpdateMapelList }) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [editingMapel, setEditingMapel] = useState<Mapel | null>(null);

  const handleDeleteAll = () => {
    const total = appState.mapelList.length;
    const notif = createNotification(
      'Hapus Semua Data Mapel',
      `Seluruh data mata pelajaran (${total} mapel) telah dihapus dari sistem.`,
      'data-mapel'
    );
    onUpdateMapelList([], notif);
    setShowDeleteAllConfirm(false);
  };

  const [form, setForm] = useState<Omit<Mapel, 'id'>>({
    kodeMapel: '',
    namaMapel: '',
    urutan: 1,
  });

  const handleOpenAdd = () => {
    setEditingMapel(null);
    setForm({
      kodeMapel: '',
      namaMapel: '',
      urutan: appState.mapelList.length + 1,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (m: Mapel) => {
    setEditingMapel(m);
    setForm({
      kodeMapel: m.kodeMapel,
      namaMapel: m.namaMapel,
      urutan: m.urutan || 1,
    });
    setShowModal(true);
  };

  const handleDelete = (m: Mapel) => {
    if (confirm(`Apakah Anda yakin ingin menghapus mapel ${m.namaMapel}?`)) {
      const updated = appState.mapelList.filter((item) => item.id !== m.id);
      const notif = createNotification(
        'Hapus Data Mapel',
        `Data mata pelajaran ${m.namaMapel} (${m.kodeMapel}) dihapus.`,
        'data-mapel'
      );
      onUpdateMapelList(updated, notif);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kodeMapel || !form.namaMapel) {
      alert('Kode Mapel dan Nama Mapel wajib diisi!');
      return;
    }

    if (editingMapel) {
      const updated = appState.mapelList.map((item) =>
        item.id === editingMapel.id ? { ...editingMapel, ...form } : item
      );
      const notif = createNotification(
        'Pembaruan Data Mapel',
        `Data mapel ${form.namaMapel} (${form.kodeMapel}) diperbarui.`,
        'data-mapel'
      );
      onUpdateMapelList(updated, notif);
    } else {
      const newMapel: Mapel = {
        id: 'm-' + Date.now(),
        ...form,
      };
      const updated = [...appState.mapelList, newMapel];
      const notif = createNotification(
        'Penambahan Data Mapel',
        `Mapel baru ${form.namaMapel} (${form.kodeMapel}) ditambahkan.`,
        'data-mapel'
      );
      onUpdateMapelList(updated, notif);
    }
    setShowModal(false);
  };

  const filteredMapel = appState.mapelList
    .filter(
      (m) =>
        m.namaMapel.toLowerCase().includes(search.toLowerCase()) ||
        m.kodeMapel.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.urutan || 99) - (b.urutan || 99));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <BookOpen className="text-blue-600" size={24} />
            <span>Manajemen Data Mata Pelajaran</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola daftar mata pelajaran kurikulum dan kode mata pelajaran sekolah.
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
            <span>Tambah Mata Pelajaran</span>
          </button>

          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={appState.mapelList.length === 0}
            className="px-3 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Hapus seluruh data mata pelajaran di sistem"
          >
            <Trash2 size={15} />
            <span>Hapus Semua Data</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama mapel..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Total Mata Pelajaran: <span className="font-extrabold text-slate-900">{filteredMapel.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-14 text-center">No</th>
                <th className="p-3.5 w-28 text-center">Urutan Transkrip</th>
                <th className="p-3.5 w-36">Kode Mapel</th>
                <th className="p-3.5">Nama Mata Pelajaran</th>
                <th className="p-3.5 w-28 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMapel.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 italic">
                    Belum ada data mata pelajaran.
                  </td>
                </tr>
              ) : (
                filteredMapel.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 text-center text-slate-400 font-semibold">{idx + 1}</td>
                    <td className="p-3.5 text-center">
                      <span className="bg-slate-100 text-slate-700 font-extrabold font-mono text-xs px-2.5 py-1 rounded-md border border-slate-200">
                        #{m.urutan || idx + 1}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-blue-600 font-mono text-sm">{m.kodeMapel}</td>
                    <td className="p-3.5 font-bold text-slate-900 text-sm">{m.namaMapel}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleOpenEdit(m)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Edit Mapel"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(m)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Hapus Mapel"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form Mapel */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingMapel ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-bold text-slate-700 mb-1">Urutan Transkrip *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.urutan || 1}
                    onChange={(e) => setForm({ ...form, urutan: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden font-mono font-bold text-center text-slate-900 bg-slate-50"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Kode Mapel *</label>
                  <input
                    type="text"
                    value={form.kodeMapel}
                    onChange={(e) => setForm({ ...form, kodeMapel: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                    placeholder="Contoh: MTK, BIN, IPA"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden font-mono font-bold text-blue-600"
                    required
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 -mt-2">
                Nomor urut menentukan posisi baris mata pelajaran saat pencetakan Transkrip Nilai, Rapor, & SKNR.
              </p>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Mata Pelajaran *</label>
                <input
                  type="text"
                  value={form.namaMapel}
                  onChange={(e) => setForm({ ...form, namaMapel: e.target.value })}
                  placeholder="Contoh: Matematika"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden font-medium text-slate-900"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import & Export MS Excel */}
      {showExcelModal && (
        <ExcelMapelModal
          appState={appState}
          onClose={() => setShowExcelModal(false)}
          onUpdateMapelList={onUpdateMapelList}
        />
      )}

      {/* Confirmation Modal Hapus Semua Data Mapel */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl shrink-0">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Semua Data Mapel</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin <strong>MENGHAPUS SELURUH DATA MATA PELAJARAN</strong> ({appState.mapelList.length} mapel)?
                </p>
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold">
                  ⚠️ Peringatan: Tindakan ini akan mengosongkan seluruh daftar mata pelajaran dari database sistem dan tidak dapat dikembalikan!
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
                Ya, Hapus Semua Data Mapel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
