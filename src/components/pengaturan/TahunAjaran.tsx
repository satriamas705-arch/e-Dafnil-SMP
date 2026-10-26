import React, { useState } from 'react';
import { AppState, TahunAjaranConfig, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { CalendarDays, CheckCircle2, Lock, Unlock, Plus, Check } from 'lucide-react';

interface TahunAjaranProps {
  appState: AppState;
  onUpdateTahunAjaran: (
    newList: TahunAjaranConfig[],
    activeId: string,
    notif: NotificationLog
  ) => void;
}

export const TahunAjaran: React.FC<TahunAjaranProps> = ({
  appState,
  onUpdateTahunAjaran,
}) => {
  const [list, setList] = useState<TahunAjaranConfig[]>([...appState.tahunAjaranList]);
  const [activeId, setActiveId] = useState<string>(appState.activeTahunAjaranId);

  const [newTahun, setNewTahun] = useState('2026/2027');
  const [newSemester, setNewSemester] = useState<'Ganjil' | 'Genap'>('Ganjil');

  const handleSetActive = (id: string) => {
    setActiveId(id);
    const updatedList = list.map((item) => ({
      ...item,
      isAktif: item.id === id,
    }));
    setList(updatedList);

    const activeItem = updatedList.find((i) => i.id === id);
    const notif = createNotification(
      'Ganti Tahun Ajaran Aktif',
      `Tahun Ajaran aktif diubah ke ${activeItem?.tahun} (${activeItem?.semester}).`,
      'pengaturan'
    );
    onUpdateTahunAjaran(updatedList, id, notif);
  };

  const handleToggleLock = (id: string) => {
    const updatedList = list.map((item) =>
      item.id === id
        ? {
            ...item,
            statusSemester:
              item.statusSemester === 'Aktif' ? ('Terkunci' as const) : ('Aktif' as const),
          }
        : item
    );
    setList(updatedList);

    const target = updatedList.find((i) => i.id === id);
    const notif = createNotification(
      'Status Semester Diubah',
      `Status semester ${target?.tahun} (${target?.semester}) diubah menjadi ${target?.statusSemester}.`,
      'pengaturan'
    );
    onUpdateTahunAjaran(updatedList, activeId, notif);
  };

  const handleAddTA = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTahun) return;

    const newItem: TahunAjaranConfig = {
      id: 'ta-' + Date.now(),
      tahun: newTahun,
      semester: newSemester,
      isAktif: false,
      statusSemester: 'Aktif',
    };

    const updatedList = [newItem, ...list];
    setList(updatedList);

    const notif = createNotification(
      'Tambah Tahun Ajaran Baru',
      `Tahun Ajaran ${newTahun} (${newSemester}) berhasil ditambahkan.`,
      'pengaturan'
    );
    onUpdateTahunAjaran(updatedList, activeId, notif);
    setNewTahun('');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <CalendarDays className="text-blue-600" size={24} />
            <span>Pengaturan Tahun Ajaran & Semester</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Atur kalender akademik aktif, semester beroperasi, dan penguncian entri nilai lampau.
          </p>
        </div>
      </div>

      {/* Form Add TA */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <h3 className="text-xs font-bold text-slate-800 uppercase mb-3">
          Tambah Tahun Ajaran Baru
        </h3>
        <form onSubmit={handleAddTA} className="flex flex-col sm:flex-row gap-3 text-xs">
          <input
            type="text"
            value={newTahun}
            onChange={(e) => setNewTahun(e.target.value)}
            placeholder="Contoh: 2026/2027"
            className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 font-semibold focus:outline-hidden"
            required
          />

          <select
            value={newSemester}
            onChange={(e) => setNewSemester(e.target.value as any)}
            className="px-3.5 py-2 bg-white rounded-xl border border-slate-200 font-semibold focus:outline-hidden"
          >
            <option value="Ganjil">Semester Ganjil</option>
            <option value="Genap">Semester Genap</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-1.5 shrink-0"
          >
            <Plus size={16} />
            <span>Tambah TA</span>
          </button>
        </form>
      </div>

      {/* List TA Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-100 border-b border-slate-200 font-extrabold text-xs text-slate-800 uppercase">
          Daftar Kalender Akademik & Status Semester
        </div>

        <div className="divide-y divide-slate-100">
          {list.map((item) => {
            const isCurrentActive = item.id === activeId;
            return (
              <div
                key={item.id}
                className={`p-4 flex items-center justify-between transition-colors ${
                  isCurrentActive ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isCurrentActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <CalendarDays size={18} />
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        TA {item.tahun} ({item.semester})
                      </h4>
                      {isCurrentActive && (
                        <span className="bg-emerald-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-xs">
                          AKTIF SEKARANG
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Status Penguncian Nilai: {item.statusSemester}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleLock(item.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 border ${
                      item.statusSemester === 'Aktif'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {item.statusSemester === 'Aktif' ? (
                      <>
                        <Unlock size={14} />
                        <span>Kunci Nilai</span>
                      </>
                    ) : (
                      <>
                        <Lock size={14} />
                        <span>Buka Kunci</span>
                      </>
                    )}
                  </button>

                  {!isCurrentActive && (
                    <button
                      onClick={() => handleSetActive(item.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                    >
                      Aktifkan TA Ini
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
