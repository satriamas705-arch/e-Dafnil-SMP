import React, { useState, useEffect } from 'react';
import { AppState, AuthUser, MenuCategory } from '../types';
import {
  LayoutDashboard,
  FolderKanban,
  UserCheck,
  Layers,
  BookOpen,
  GraduationCap,
  Calculator,
  PenLine,
  FileSpreadsheet,
  ClipboardList,
  FileCheck,
  Award,
  FileBadge,
  Settings,
  School,
  CalendarDays,
  DatabaseBackup,
  KeyRound,
  ChevronDown,
  X,
  LogOut,
  Calendar,
} from 'lucide-react';

interface SidebarProps {
  appState: AppState;
  authUser?: AuthUser | null;
  activeMenu: MenuCategory;
  onSelectMenu: (menu: MenuCategory) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogout?: () => void;
  onOpenPasswordModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  appState,
  authUser,
  activeMenu,
  onSelectMenu,
  isOpenMobile,
  onCloseMobile,
  onLogout,
  onOpenPasswordModal,
}) => {
  // Dropdown states for each category
  const isDataManagementActive = [
    'data-guru',
    'data-kelas',
    'data-mapel',
    'data-siswa',
  ].includes(activeMenu);

  const isNilaiSumatifActive = ['input-nilai', 'rekap-nilai'].includes(activeMenu);

  const isAnalisisKelas9Active = [
    'input-kelas9',
    'cetak-sknr',
    'cetak-skl',
    'cetak-transkrip',
  ].includes(activeMenu);

  const isPengaturanActive = [
    'pengaturan-sekolah',
    'tahun-ajaran',
    'backup-restore',
    'ubah-password',
  ].includes(activeMenu);

  // Initialize dropdown open states
  const [openDataManagement, setOpenDataManagement] = useState<boolean>(true);
  const [openNilaiSumatif, setOpenNilaiSumatif] = useState<boolean>(true);
  const [openAnalisisKelas9, setOpenAnalisisKelas9] = useState<boolean>(true);
  const [openPengaturan, setOpenPengaturan] = useState<boolean>(true);

  // Auto-expand the active menu's parent dropdown when activeMenu changes
  useEffect(() => {
    if (isDataManagementActive) setOpenDataManagement(true);
    if (isNilaiSumatifActive) setOpenNilaiSumatif(true);
    if (isAnalisisKelas9Active) setOpenAnalisisKelas9(true);
    if (isPengaturanActive) setOpenPengaturan(true);
  }, [activeMenu]);

  const handleSubmenuClick = (menu: MenuCategory) => {
    onSelectMenu(menu);
    onCloseMobile();
  };

  // Role Checks & RBAC
  const isGuru = authUser?.role === 'guru';
  const isAdmin = !authUser || authUser.role === 'admin';

  const currentGuru = isGuru
    ? appState.guruList.find(
        (g) =>
          g.id === authUser.guruId ||
          (authUser.nip && g.nip === authUser.nip) ||
          g.nama.toLowerCase() === authUser.nama.toLowerCase() ||
          g.nama.toLowerCase().includes(authUser.username.toLowerCase()) ||
          authUser.username.toLowerCase().includes(g.nama.toLowerCase().split(' ')[0])
      )
    : null;

  // Check if current user is Wali Kelas (any grade)
  const waliKelasObj = currentGuru
    ? appState.kelasList.find(
        (k) =>
          k.waliKelasId === currentGuru.id ||
          k.waliKelasNama?.toLowerCase() === currentGuru.nama.toLowerCase() ||
          (authUser?.nama && k.waliKelasNama?.toLowerCase().includes(authUser.nama.toLowerCase()))
      )
    : null;

  const isWaliKelas = isAdmin || Boolean(waliKelasObj);

  // Check if current user is Wali Kelas 9 specifically
  const waliKelas9Obj = currentGuru
    ? appState.kelasList.find((k) => {
        const isClass9 =
          Number(k.tingkat) === 9 ||
          k.kodeKelas.startsWith('9') ||
          k.kodeKelas.startsWith('IX') ||
          k.namaKelas.includes('9') ||
          k.namaKelas.includes('IX');
        const isWali =
          k.waliKelasId === currentGuru.id ||
          k.waliKelasNama?.toLowerCase() === currentGuru.nama.toLowerCase() ||
          (authUser?.nama && k.waliKelasNama?.toLowerCase().includes(authUser.nama.toLowerCase()));
        return isClass9 && isWali;
      })
    : null;

  const isWaliKelas9 = isAdmin || Boolean(waliKelas9Obj);

  // Access rights
  const canAccessAnalisisKelas9 = isAdmin || isWaliKelas9;
  const canAccessRekapNilai = isAdmin || isWaliKelas;

  // Active academic year
  const activeTA =
    appState.tahunAjaranList.find((t) => t.id === appState.activeTahunAjaranId) ||
    appState.tahunAjaranList.find((t) => t.isAktif) ||
    appState.tahunAjaranList[0];

  // Helper to extract initials
  const getUserInitials = (name?: string): string => {
    if (!name) return 'AD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const displayName = authUser?.nama || 'Administrator';
  const displayRoleSubtitle = isGuru
    ? authUser?.nip
      ? `NIP. ${authUser.nip}`
      : 'Guru Pengampu'
    : 'Administrator Sistem';

  const userPhotoUrl =
    authUser?.fotoUrl ||
    (isGuru
      ? currentGuru?.fotoUrl
      : appState.sekolah.adminFotoUrl ||
        appState.userAccounts?.find((a) => a.role === 'admin')?.fotoUrl);

  const schoolName = appState.sekolah.namaSekolah || 'SMP Negeri 2 Kemranjen';
  const schoolLogo = appState.sekolah.logoUrl || '/logo.png';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out shrink-0 border-r border-slate-800 shadow-2xl md:shadow-none print:hidden ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Header: School Logo & Title */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/40">
          <button
            onClick={() => handleSubmenuClick('dashboard')}
            className="flex items-center space-x-3 text-left group cursor-pointer min-w-0"
          >
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0 group-hover:scale-105 transition-transform">
              <img
                src={schoolLogo}
                alt={`Logo ${schoolName}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/favicon.svg';
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-white text-base tracking-tight leading-none group-hover:text-blue-400 transition-colors">
                  e-Dafnil
                </span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-blue-600/30 text-blue-300 border border-blue-500/30">
                  SMP
                </span>
              </div>
              <span
                className="text-[11px] text-slate-400 font-medium tracking-wide truncate max-w-[145px] block mt-1"
                title={schoolName}
              >
                {schoolName}
              </span>
            </div>
          </button>
          <button
            onClick={onCloseMobile}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 md:hidden cursor-pointer"
            title="Tutup Menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Item Scroll List */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5 custom-scrollbar">
          {/* Section: UTAMA */}
          <div className="pt-1 pb-1 px-2.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
            Utama
          </div>

          {/* Menu Dashboard */}
          <button
            onClick={() => handleSubmenuClick('dashboard')}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
              activeMenu === 'dashboard'
                ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard
              size={18}
              className={activeMenu === 'dashboard' ? 'text-white' : 'text-blue-400 shrink-0'}
            />
            <span className="text-xs font-semibold">Dashboard</span>
          </button>

          {/* Section: MANAJEMEN DATA (Dropdown - Admin Only) */}
          {isAdmin && (
            <div className="pt-2">
              <div className="pb-1 px-2.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                Manajemen
              </div>

              <div className="space-y-1">
                {/* Parent Dropdown Button */}
                <button
                  type="button"
                  onClick={() => setOpenDataManagement(!openDataManagement)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isDataManagementActive
                      ? 'bg-slate-800 text-white font-bold ring-1 ring-indigo-500/40 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <FolderKanban
                      size={18}
                      className={isDataManagementActive ? 'text-indigo-400' : 'text-slate-400 shrink-0'}
                    />
                    <span className="text-xs font-semibold">Manajemen Data</span>
                  </div>
                  <ChevronDown
                    size={15}
                    className={`text-slate-400 transition-transform duration-200 ${
                      openDataManagement ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Submenu Items Dropdown */}
                {openDataManagement && (
                  <div className="ml-4 pl-3.5 border-l-2 border-indigo-500/30 space-y-1 py-1 animate-in fade-in duration-200">
                    <button
                      onClick={() => handleSubmenuClick('data-guru')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'data-guru'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <UserCheck
                        size={15}
                        className={activeMenu === 'data-guru' ? 'text-white' : 'text-blue-400 shrink-0'}
                      />
                      <span className="truncate">Data Guru</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('data-kelas')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'data-kelas'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <Layers
                        size={15}
                        className={activeMenu === 'data-kelas' ? 'text-white' : 'text-emerald-400 shrink-0'}
                      />
                      <span className="truncate">Data Kelas</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('data-mapel')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'data-mapel'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <BookOpen
                        size={15}
                        className={activeMenu === 'data-mapel' ? 'text-white' : 'text-amber-400 shrink-0'}
                      />
                      <span className="truncate">Data Mapel</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('data-siswa')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'data-siswa'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <GraduationCap
                        size={15}
                        className={activeMenu === 'data-siswa' ? 'text-white' : 'text-purple-400 shrink-0'}
                      />
                      <span className="truncate">Data Siswa</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: PENILAIAN (Dropdown - Admin & Guru) */}
          <div className="pt-2">
            <div className="pb-1 px-2.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
              Penilaian
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setOpenNilaiSumatif(!openNilaiSumatif)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  isNilaiSumatifActive
                    ? 'bg-slate-800 text-white font-bold ring-1 ring-emerald-500/40 shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Calculator
                    size={18}
                    className={isNilaiSumatifActive ? 'text-emerald-400' : 'text-slate-400 shrink-0'}
                  />
                  <span className="text-xs font-semibold">Nilai Sumatif</span>
                </div>
                <ChevronDown
                  size={15}
                  className={`text-slate-400 transition-transform duration-200 ${
                    openNilaiSumatif ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openNilaiSumatif && (
                <div className="ml-4 pl-3.5 border-l-2 border-emerald-500/30 space-y-1 py-1 animate-in fade-in duration-200">
                  <button
                    onClick={() => handleSubmenuClick('input-nilai')}
                    className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                      activeMenu === 'input-nilai'
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <PenLine
                      size={15}
                      className={activeMenu === 'input-nilai' ? 'text-white' : 'text-emerald-400 shrink-0'}
                    />
                    <span className="truncate">Input Nilai</span>
                  </button>

                  {canAccessRekapNilai && (
                    <button
                      onClick={() => handleSubmenuClick('rekap-nilai')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'rekap-nilai'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <FileSpreadsheet
                        size={15}
                        className={activeMenu === 'rekap-nilai' ? 'text-white' : 'text-teal-400 shrink-0'}
                      />
                      <span className="truncate">Rekap Nilai</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section: ANALISIS KELAS 9 (Dropdown - Admin & Wali Kelas 9) */}
          {canAccessAnalisisKelas9 && (
            <div className="pt-2">
              <div className="pb-1 px-2.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                Kelulusan K9
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenAnalisisKelas9(!openAnalisisKelas9)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isAnalisisKelas9Active
                      ? 'bg-slate-800 text-white font-bold ring-1 ring-amber-500/40 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Award
                      size={18}
                      className={isAnalisisKelas9Active ? 'text-amber-400' : 'text-slate-400 shrink-0'}
                    />
                    <span className="text-xs font-semibold">Analisis Kelas 9</span>
                  </div>
                  <ChevronDown
                    size={15}
                    className={`text-slate-400 transition-transform duration-200 ${
                      openAnalisisKelas9 ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openAnalisisKelas9 && (
                  <div className="ml-4 pl-3.5 border-l-2 border-amber-500/30 space-y-1 py-1 animate-in fade-in duration-200">
                    <button
                      onClick={() => handleSubmenuClick('input-kelas9')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'input-kelas9'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <ClipboardList
                        size={15}
                        className={activeMenu === 'input-kelas9' ? 'text-white' : 'text-amber-400 shrink-0'}
                      />
                      <span className="truncate">Input Nilai K9</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('cetak-sknr')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'cetak-sknr'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <FileCheck
                        size={15}
                        className={activeMenu === 'cetak-sknr' ? 'text-white' : 'text-blue-400 shrink-0'}
                      />
                      <span className="truncate">Cetak SKNR</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('cetak-skl')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'cetak-skl'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <Award
                        size={15}
                        className={activeMenu === 'cetak-skl' ? 'text-white' : 'text-emerald-400 shrink-0'}
                      />
                      <span className="truncate">Cetak SKL</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('cetak-transkrip')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'cetak-transkrip'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <FileBadge
                        size={15}
                        className={activeMenu === 'cetak-transkrip' ? 'text-white' : 'text-purple-400 shrink-0'}
                      />
                      <span className="truncate">Cetak Transkrip</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: PENGATURAN & SISTEM (Dropdown - Admin Only) */}
          {isAdmin && (
            <div className="pt-2">
              <div className="pb-1 px-2.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                Sistem
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenPengaturan(!openPengaturan)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isPengaturanActive
                      ? 'bg-slate-800 text-white font-bold ring-1 ring-cyan-500/40 shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Settings
                      size={18}
                      className={isPengaturanActive ? 'text-cyan-400' : 'text-slate-400 shrink-0'}
                    />
                    <span className="text-xs font-semibold">Pengaturan</span>
                  </div>
                  <ChevronDown
                    size={15}
                    className={`text-slate-400 transition-transform duration-200 ${
                      openPengaturan ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {openPengaturan && (
                  <div className="ml-4 pl-3.5 border-l-2 border-cyan-500/30 space-y-1 py-1 animate-in fade-in duration-200">
                    <button
                      onClick={() => handleSubmenuClick('pengaturan-sekolah')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'pengaturan-sekolah'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <School
                        size={15}
                        className={activeMenu === 'pengaturan-sekolah' ? 'text-white' : 'text-sky-400 shrink-0'}
                      />
                      <span className="truncate">Profil Sekolah</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('tahun-ajaran')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'tahun-ajaran'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <CalendarDays
                        size={15}
                        className={activeMenu === 'tahun-ajaran' ? 'text-white' : 'text-amber-400 shrink-0'}
                      />
                      <span className="truncate">Tahun Pelajaran</span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('backup-restore')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'backup-restore'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <DatabaseBackup
                          size={15}
                          className={activeMenu === 'backup-restore' ? 'text-white' : 'text-indigo-400 shrink-0'}
                        />
                        <span className="truncate">Backup & Restore</span>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                          activeMenu === 'backup-restore'
                            ? 'bg-blue-700 text-white'
                            : 'bg-indigo-500/20 text-indigo-300'
                        }`}
                      >
                        SQL
                      </span>
                    </button>

                    <button
                      onClick={() => handleSubmenuClick('ubah-password')}
                      className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all text-left text-xs ${
                        activeMenu === 'ubah-password'
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <KeyRound
                        size={15}
                        className={activeMenu === 'ubah-password' ? 'text-white' : 'text-rose-400 shrink-0'}
                      />
                      <span className="truncate">Ubah Password</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section: AKUN (For Guru) */}
          {isGuru && (
            <div className="pt-2">
              <div className="pb-1 px-2.5 text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                Akun Saya
              </div>
              <button
                onClick={() => handleSubmenuClick('ubah-password')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  activeMenu === 'ubah-password'
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <KeyRound
                  size={18}
                  className={activeMenu === 'ubah-password' ? 'text-white' : 'text-cyan-400 shrink-0'}
                />
                <span className="text-xs font-semibold">Ubah Password</span>
              </button>
            </div>
          )}
        </nav>

        {/* Sidebar Footer: Active Academic Year & User Profile Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0 space-y-2">
          {/* Active Academic Year Pill */}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5 text-slate-300 truncate">
              <Calendar size={13} className="text-blue-400 shrink-0" />
              <span className="truncate font-semibold">
                {authUser?.tahunAjaran || activeTA?.tahun || '2025/2026'}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
              {authUser?.semester || activeTA?.semester || 'Genap'}
            </span>
          </div>

          {/* User Account Strip */}
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs shrink-0 ${
                  isGuru ? 'bg-indigo-600' : 'bg-blue-600'
                }`}
              >
                {userPhotoUrl ? (
                  <img src={userPhotoUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  getUserInitials(displayName)
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate" title={displayName}>
                  {displayName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {isGuru ? (authUser?.nip ? `NIP. ${authUser.nip}` : 'Guru') : 'Administrator'}
                </div>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                title="Keluar dari Akun"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
