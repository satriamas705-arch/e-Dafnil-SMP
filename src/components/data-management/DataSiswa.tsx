import React, { useState } from 'react';
import { AppState, Siswa, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { ExcelSiswaModal } from './ExcelSiswaModal';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';

interface DataSiswaProps {
  appState: AppState;
  onUpdateSiswaList: (newList: Siswa[], notif: NotificationLog) => void;
  initialSearchQuery?: string;
}

export const DataSiswa: React.FC<DataSiswaProps> = ({
  appState,
  onUpdateSiswaList,
  initialSearchQuery = '',
}) => {
  const [search, setSearch] = useState(initialSearchQuery);
  const [kelasFilter, setKelasFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null);

  const [form, setForm] = useState<Omit<Siswa, 'id' | 'kodeKelas'>>({
    nis: '',
    nisn: '',
    nama: '',
    jenisKelamin: 'L',
    agama: 'Islam',
    kelasId: appState.kelasList[0]?.id || '',
    tempatLahir: 'Jakarta',
    tanggalLahir: '2011-01-01',
    status: 'Aktif',
  });

  const handleOpenAdd = () => {
    setEditingSiswa(null);
    setForm({
      nis: '',
      nisn: '',
      nama: '',
      jenisKelamin: 'L',
      agama: 'Islam',
      kelasId: appState.kelasList[0]?.id || '',
      tempatLahir: 'Jakarta',
      tanggalLahir: '2011-01-01',
      status: 'Aktif',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (s: Siswa) => {
    setEditingSiswa(s);
    setForm({
      nis: s.nis,
      nisn: s.nisn,
      nama: s.nama,
      jenisKelamin: s.jenisKelamin,
      agama: s.agama || 'Islam',
      kelasId: s.kelasId,
      tempatLahir: s.tempatLahir,
      tanggalLahir: s.tanggalLahir,
      status: s.status,
    });
    setShowModal(true);
  };

  const handleDelete = (s: Siswa) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data siswa ${s.nama}?`)) {
      const updated = appState.siswaList.filter((item) => item.id !== s.id);
      const notif = createNotification(
        'Hapus Data Siswa',
        `Data siswa ${s.nama} (${s.nisn}) dihapus.`,
        'data-siswa'
      );
      onUpdateSiswaList(updated, notif);
    }
  };

  const handleDeleteAll = () => {
    const total = appState.siswaList.length;
    const notif = createNotification(
      'Hapus Semua Data Siswa',
      `Seluruh data siswa (${total} siswa) telah dihapus dari sistem.`,
      'data-siswa'
    );
    onUpdateSiswaList([], notif);
    setShowDeleteAllConfirm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama || !form.nisn) {
      alert('Nama Siswa dan NISN wajib diisi!');
      return;
    }

    const kelasObj = appState.kelasList.find((k) => k.id === form.kelasId);
    const kodeKelas = kelasObj ? kelasObj.kodeKelas : '7A';

    if (editingSiswa) {
      const updated = appState.siswaList.map((item) =>
        item.id === editingSiswa.id ? { ...editingSiswa, ...form, kodeKelas } : item
      );
      const notif = createNotification(
        'Pembaruan Data Siswa',
        `Data siswa ${form.nama} (Kelas ${kodeKelas}) diperbarui.`,
        'data-siswa'
      );
      onUpdateSiswaList(updated, notif);
    } else {
      const newSiswa: Siswa = {
        id: 's-' + Date.now(),
        ...form,
        kodeKelas,
      };
      const updated = [...appState.siswaList, newSiswa];
      const notif = createNotification(
        'Penambahan Data Siswa',
        `Siswa baru ${form.nama} (NISN: ${form.nisn}) ditambahkan ke Kelas ${kodeKelas}.`,
        'data-siswa'
      );
      onUpdateSiswaList(updated, notif);
    }
    setShowModal(false);
  };

  const filteredSiswa = appState.siswaList.filter((s) => {
    const query = search.toLowerCase();
    const matchSearch =
      s.nama.toLowerCase().includes(query) ||
      s.nisn.includes(query) ||
      s.nis.includes(query) ||
      (s.agama && s.agama.toLowerCase().includes(query)) ||
      s.kodeKelas.toLowerCase().includes(query);

    const matchKelas = kelasFilter === 'ALL' || s.kelasId === kelasFilter;
    return matchSearch && matchKelas;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <GraduationCap className="text-blue-600" size={24} />
            <span>Manajemen Data Siswa</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data peserta didik, NISN, NIS, kelas, agama, tempat & tanggal lahir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowExcelModal(true)}
            className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-700/20 flex items-center space-x-1.5 cursor-pointer transition-all"
          >
            <FileSpreadsheet size={16} />
            <span>Export / Import Excel</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center space-x-1.5 cursor-pointer transition-all"
          >
            <Plus size={16} />
            <span>Tambah Siswa</span>
          </button>

          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={appState.siswaList.length === 0}
            className="px-3 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 flex items-center space-x-1.5 cursor-pointer transition-all"
            title="Hapus seluruh data siswa di sistem"
          >
            <Trash2 size={15} />
            <span>Hapus Semua Data</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, NISN, NIS, atau agama..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Kelas:</span>
          <select
            value={kelasFilter}
            onChange={(e) => setKelasFilter(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden"
          >
            <option value="ALL">Semua Rombel Kelas</option>
            {appState.kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.namaKelas}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3.5">No</th>
                <th className="p-3.5">Identitas Siswa</th>
                <th className="p-3.5">NISN / NIS</th>
                <th className="p-3.5">Agama</th>
                <th className="p-3.5">Kelas</th>
                <th className="p-3.5">Tempat, Tgl Lahir</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSiswa.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Tidak ada data siswa yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredSiswa.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-sm">{s.nama}</div>
                      <div className="text-[11px] text-slate-500">
                        {s.jenisKelamin === 'L' ? 'Laki-laki (L)' : 'Perempuan (P)'}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700">
                      <div className="font-bold text-blue-600">{s.nisn}</div>
                      <div className="text-[10px] text-slate-400">NIS: {s.nis || '-'}</div>
                    </td>
                    <td className="p-3.5 font-semibold text-purple-700">
                      <span className="bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                        {s.agama || 'Islam'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-200">
                        {s.kodeKelas}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">
                      <div>{s.tempatLahir}</div>
                      <div className="text-[10px] text-slate-400">{s.tanggalLahir}</div>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          s.status === 'Aktif'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'Lulus'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
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

      {/* Modal Form Siswa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingSiswa ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NISN (10 Digit) *</label>
                  <input
                    type="text"
                    value={form.nisn}
                    onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                    placeholder="e.g. 0089123401"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIS Lokal</label>
                  <input
                    type="text"
                    value={form.nis}
                    onChange={(e) => setForm({ ...form, nis: e.target.value })}
                    placeholder="e.g. 23240901"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Siswa *</label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  placeholder="Sesuai ijazah sebelumnya"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={form.jenisKelamin}
                    onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value as 'L' | 'P' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Agama Siswa</label>
                  <select
                    value={form.agama}
                    onChange={(e) => setForm({ ...form, agama: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden font-medium"
                  >
                    <option value="Islam">Islam</option>
                    <option value="Kristen">Kristen</option>
                    <option value="Katolik">Katolik</option>
                    <option value="Hindu">Hindu</option>
                    <option value="Buddha">Buddha</option>
                    <option value="Khonghucu">Khonghucu</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Rombel Kelas</label>
                  <select
                    value={form.kelasId}
                    onChange={(e) => setForm({ ...form, kelasId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    {appState.kelasList.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.namaKelas} (Tingkat {k.tingkat})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Keaktifan</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as 'Aktif' | 'Lulus' | 'Pindah' | 'Keluar' })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Lulus">Lulus</option>
                    <option value="Pindah">Pindah</option>
                    <option value="Keluar">Keluar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tempat Lahir</label>
                  <input
                    type="text"
                    value={form.tempatLahir}
                    onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })}
                    placeholder="e.g. Jakarta"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={form.tanggalLahir}
                    onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 font-bold text-white shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal Hapus Semua Data */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl shrink-0">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus Semua Data Siswa</h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  Apakah Anda yakin ingin <strong>MENGHAPUS SELURUH DATA SISWA</strong> ({appState.siswaList.length} siswa)?
                </p>
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 font-semibold">
                  ⚠️ Peringatan: Tindakan ini akan mengosongkan seluruh daftar peserta didik dari database sistem dan tidak dapat dikembalikan!
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
                Ya, Hapus Semua Data Siswa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MS Excel Modal Component */}
      {showExcelModal && (
        <ExcelSiswaModal
          appState={appState}
          onClose={() => setShowExcelModal(false)}
          onUpdateSiswaList={onUpdateSiswaList}
        />
      )}
    </div>
  );
};

