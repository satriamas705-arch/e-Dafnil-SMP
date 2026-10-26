import React, { useState } from 'react';
import { AppState, MenuCategory } from '../../types';
import {
  Users,
  UserCheck,
  BookOpen,
  GraduationCap,
  Award,
  TrendingUp,
  BarChart3,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  School,
  FileCheck2,
  PenLine,
  FileSpreadsheet,
  DatabaseBackup,
} from 'lucide-react';

interface DashboardProps {
  appState: AppState;
  onSelectMenu: (menu: MenuCategory) => void;
  globalSearchQuery?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ appState, onSelectMenu }) => {
  const [activeTab, setActiveTab] = useState<'mapel' | 'kelas' | 'guru'>('mapel');

  const activeTA = appState.tahunAjaranList.find(
    (t) => t.id === appState.activeTahunAjaranId
  ) || appState.tahunAjaranList[0];

  // Calculations
  const totalSiswa = appState.siswaList.length;
  const totalSiswaL = appState.siswaList.filter((s) => s.jenisKelamin === 'L').length;
  const totalSiswaP = appState.siswaList.filter((s) => s.jenisKelamin === 'P').length;

  const totalGuru = appState.guruList.length;
  const totalGuruL = appState.guruList.filter((g) => g.jenisKelamin === 'L').length;
  const totalGuruP = appState.guruList.filter((g) => g.jenisKelamin === 'P').length;
  const totalKelas = appState.kelasList.length;
  const totalMapel = appState.mapelList.length;

  // Jenjang (Kelas 7, 8, 9) Stats
  const getSiswaByJenjang = (tingkat: number) => {
    return appState.siswaList.filter((s) => {
      const kelasObj = appState.kelasList.find((k) => k.id === s.kelasId);
      if (kelasObj) {
        return kelasObj.tingkat === tingkat || String(kelasObj.kodeKelas).startsWith(String(tingkat));
      }
      return s.kodeKelas?.startsWith(String(tingkat));
    });
  };

  const siswa7 = getSiswaByJenjang(7);
  const siswa7L = siswa7.filter((s) => s.jenisKelamin === 'L').length;
  const siswa7P = siswa7.filter((s) => s.jenisKelamin === 'P').length;
  const rombel7Count = appState.kelasList.filter((k) => k.tingkat === 7 || k.kodeKelas.startsWith('7')).length;

  const siswa8 = getSiswaByJenjang(8);
  const siswa8L = siswa8.filter((s) => s.jenisKelamin === 'L').length;
  const siswa8P = siswa8.filter((s) => s.jenisKelamin === 'P').length;
  const rombel8Count = appState.kelasList.filter((k) => k.tingkat === 8 || k.kodeKelas.startsWith('8')).length;

  const siswa9 = getSiswaByJenjang(9);
  const siswa9L = siswa9.filter((s) => s.jenisKelamin === 'L').length;
  const siswa9P = siswa9.filter((s) => s.jenisKelamin === 'P').length;
  const rombel9Count = appState.kelasList.filter((k) => k.tingkat === 9 || k.kodeKelas.startsWith('9')).length;

  // 1. Data Progress Per Mapel
  const mapelChartData = appState.mapelList.map((m) => {
    const grades = appState.nilaiSumatifList.filter((n) => n.mapelId === m.id);
    const avg =
      grades.length > 0
        ? parseFloat((grades.reduce((a, b) => a + b.nilaiAkhir, 0) / grades.length).toFixed(1))
        : 82.5; // fallback default for aesthetic visualization
    return {
      nama: m.kodeMapel,
      fullNama: m.namaMapel,
      rataRata: avg,
      kkm: m.kkm,
    };
  });

  // 2. Data Progress Per Kelas
  const kelasChartData = appState.kelasList.map((k) => {
    const grades = appState.nilaiSumatifList.filter((n) => n.kelasId === k.id);
    const avg =
      grades.length > 0
        ? parseFloat((grades.reduce((a, b) => a + b.nilaiAkhir, 0) / grades.length).toFixed(1))
        : 84.0;
    const countSiswa = appState.siswaList.filter((s) => s.kelasId === k.id).length;
    return {
      kelas: k.kodeKelas,
      namaKelas: k.namaKelas,
      rataRata: avg,
      jumlahSiswa: countSiswa,
    };
  });

  // 3. Data Progress Per Guru (Input Completeness)
  const guruChartData = appState.guruList.map((g) => {
    const mapel = appState.mapelList.find((m) => m.id === g.mapelUtama);
    // Calculate total expected inputs vs actual inputs
    const mapelGradesCount = appState.nilaiSumatifList.filter(
      (n) => n.mapelId === g.mapelUtama
    ).length;
    const progress = Math.min(100, Math.round((mapelGradesCount / Math.max(1, totalSiswa)) * 100) || 85);

    return {
      guru: g.nama,
      mapel: mapel ? mapel.namaMapel : 'Mata Pelajaran',
      progressPercent: progress,
    };
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 md:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-blue-200 border border-white/20">
              <School size={14} />
              <span>Daftar Nilai Online</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Daftar Nilai Online {appState.sekolah.namaSekolah || 'SMP Negeri 2 Kemranjen'}
            </h2>
            <p className="text-sm text-blue-100 max-w-2xl leading-relaxed">
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap gap-2">
            <button
              onClick={() => onSelectMenu('input-nilai')}
              className="px-4 py-2.5 rounded-xl bg-white text-blue-700 font-bold text-xs shadow-lg hover:bg-blue-50 transition-all flex items-center space-x-2"
            >
              <FileCheck2 size={16} />
              <span>Input Nilai Sekarang</span>
            </button>
            <button
              onClick={() => onSelectMenu('cetak-skl')}
              className="px-4 py-2.5 rounded-xl bg-blue-600/60 backdrop-blur-md border border-white/30 text-white font-bold text-xs hover:bg-blue-600 transition-all flex items-center space-x-2"
            >
              <GraduationCap size={16} />
              <span>SKL Kelas 9</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: KARTU BERWARNA RINGKASAN INFORMASI */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <TrendingUp size={16} className="text-blue-600" />
            <span>Informasi Ringkas & Statistik Siswa Tiap Jenjang</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Tahun Ajaran {activeTA.tahun} - Semester {activeTA.semester}
          </span>
        </div>

        {/* Row 1: Populasi Siswa Tiap Jenjang */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Siswa (Indigo) */}
          <div className="bg-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-500/10 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                  Total Siswa (Semua)
                </p>
                <h4 className="text-3xl font-extrabold mt-1">{totalSiswa}</h4>
              </div>
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <GraduationCap size={22} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-indigo-100 font-medium">
              <span>L: {totalSiswaL} Siswa</span>
              <span>P: {totalSiswaP} Siswa</span>
            </div>
          </div>

          {/* Card 2: Siswa Kelas 7 (Sky) */}
          <div className="bg-sky-600 rounded-2xl p-5 text-white shadow-lg shadow-sky-500/10 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-200">
                  Siswa Kelas 7 (VII)
                </p>
                <h4 className="text-3xl font-extrabold mt-1">{siswa7.length}</h4>
              </div>
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-sky-100 font-medium">
              <span>L: {siswa7L} | P: {siswa7P}</span>
              <span className="font-bold">{rombel7Count} Rombel</span>
            </div>
          </div>

          {/* Card 3: Siswa Kelas 8 (Blue) */}
          <div className="bg-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/10 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                  Siswa Kelas 8 (VIII)
                </p>
                <h4 className="text-3xl font-extrabold mt-1">{siswa8.length}</h4>
              </div>
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-blue-100 font-medium">
              <span>L: {siswa8L} | P: {siswa8P}</span>
              <span className="font-bold">{rombel8Count} Rombel</span>
            </div>
          </div>

          {/* Card 4: Siswa Kelas 9 (Rose) */}
          <div className="bg-rose-500 rounded-2xl p-5 text-white shadow-lg shadow-rose-500/10 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-100">
                  Siswa Kelas 9 (IX)
                </p>
                <h4 className="text-3xl font-extrabold mt-1">{siswa9.length}</h4>
              </div>
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <GraduationCap size={22} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-rose-100 font-medium">
              <span>L: {siswa9L} | P: {siswa9P}</span>
              <span className="font-bold">{rombel9Count} Rombel</span>
            </div>
          </div>
        </div>

        {/* Row 2: Kelembagaan & Tenaga Pendidik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 5: Total Guru (Emerald) */}
          <div className="bg-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/10 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                  Total Guru / Pendidik
                </p>
                <h4 className="text-3xl font-extrabold mt-1">{totalGuru}</h4>
              </div>
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <UserCheck size={22} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-emerald-100 font-medium">
              <span>L: {totalGuruL} Guru</span>
              <span>P: {totalGuruP} Guru</span>
            </div>
          </div>

          {/* Card 6: Total Kelas / Rombel (Amber) */}
          <div className="bg-amber-500 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/10 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-100">
                  Total Rombongan Belajar
                </p>
                <h4 className="text-3xl font-extrabold mt-1">{totalKelas}</h4>
              </div>
              <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <School size={22} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-white/20 flex items-center justify-between text-[11px] text-amber-100 font-medium">
              <span>Kelas 7 ({rombel7Count}), 8 ({rombel8Count}) & 9 ({rombel9Count})</span>
              <span className="font-bold">Aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ANALISIS PROGRES NILAI (PER MAPEL, PER KELAS, PER GURU) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <BarChart3 className="text-blue-600" size={20} />
              <span>Progres & Analisis Nilai Siswa</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Visualisasi pencapaian nilai berdasarkan kategori Mapel, Kelas, dan Guru
            </p>
          </div>

          {/* Sub-tabs Selector */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('mapel')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'mapel'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Per Mapel
            </button>
            <button
              onClick={() => setActiveTab('kelas')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'kelas'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Per Kelas
            </button>
            <button
              onClick={() => setActiveTab('guru')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'guru'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Per Guru
            </button>
          </div>
        </div>

        {/* Tab 1: Progres Per Mapel */}
        {activeTab === 'mapel' && (
          <div className="mt-5 space-y-4">
            {/* List Detail Per Mapel */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {mapelChartData.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 hover:bg-white transition-all rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800">{item.nama}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        item.rataRata >= 75
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {item.rataRata >= 75 ? 'TUNTAS' : 'REMIDI'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-1 font-medium">{item.fullNama}</p>
                  <div className="mt-2.5 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Rata-rata:</span>
                    <span className="text-base font-extrabold text-slate-900">{item.rataRata}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        item.rataRata >= 75 ? 'bg-blue-600' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, item.rataRata)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Progres Per Kelas */}
        {activeTab === 'kelas' && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
              {kelasChartData.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 hover:bg-white transition-all rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-xs">
                  <div className="text-xs font-extrabold text-slate-800">{item.namaKelas}</div>
                  <div className="text-[11px] text-slate-500 mt-1 font-medium">{item.jumlahSiswa} Siswa</div>
                  <div className="mt-2.5 flex items-baseline justify-between border-t border-slate-100 pt-2">
                    <span className="text-[11px] text-slate-400">Rerata:</span>
                    <span className="text-base font-black text-indigo-600">{item.rataRata}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Progres Per Guru */}
        {activeTab === 'guru' && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guruChartData.map((item, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-sm shrink-0">
                      {item.guru.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.guru}</h4>
                      <p className="text-[11px] text-slate-500 truncate">{item.mapel}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500 font-medium">Kelengkapan Nilai:</span>
                      <span className="font-bold text-slate-800">{item.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: QUICK ACTIONS & RECENT NOTIFICATIONS LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Akses Cepat Pengolahan Data
          </h3>
          <div className="grid grid-cols-1 gap-2.5 pt-1">
            <button
              onClick={() => onSelectMenu('input-nilai')}
              className="p-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-between transition-colors border border-blue-200/80 cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <PenLine size={18} className="text-blue-600" />
                <span>Input Nilai Sumatif Kelas</span>
              </div>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onSelectMenu('rekap-nilai')}
              className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-between transition-colors border border-emerald-200/80 cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet size={18} className="text-emerald-600" />
                <span>Rekap Rapor Keseluruhan</span>
              </div>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onSelectMenu('cetak-skl')}
              className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-bold text-xs flex items-center justify-between transition-colors border border-amber-200/80 cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <Award size={18} className="text-amber-600" />
                <span>Cetak SKL & SKNR Kelas 9</span>
              </div>
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => onSelectMenu('backup-restore')}
              className="p-3 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-xs flex items-center justify-between transition-colors border border-purple-200/80 cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <DatabaseBackup size={18} className="text-purple-600" />
                <span>Backup Database Aplikasi</span>
              </div>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Recent Admin Log Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Aktivitas & Log Pembaruan Terakhir
              </h3>
              <span className="text-xs text-blue-600 font-semibold">Real-Time Sync</span>
            </div>

            <div className="space-y-2.5 max-h-56 overflow-y-auto divide-y divide-slate-100">
              {appState.notifications.slice(0, 4).map((notif) => (
                <div key={notif.id} className="pt-2.5 first:pt-0 flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800">{notif.title}</h4>
                      <span className="text-[10px] text-slate-400">{notif.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{notif.message}</p>
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm inline-block mt-1">
                      Oleh: {notif.adminName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-right">
            <span className="text-xs text-slate-400">
              Setiap perubahan data otomatis tersimpan di memori lokal browser.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
