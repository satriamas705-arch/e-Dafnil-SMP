import React, { useState } from 'react';
import { AppState, MenuCategory, NotificationLog, AuthUser } from '../types';
import { PhotoUploadModal } from './common/PhotoUploadModal';
import {
  Bell,
  Search,
  CheckCircle2,
  Trash2,
  Calendar,
  X,
  Menu,
  LogOut,
  ChevronRight,
  KeyRound,
  Camera,
  Info,
} from 'lucide-react';

interface HeaderProps {
  appState: AppState;
  activeMenu: MenuCategory;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  onSelectMenu: (menu: MenuCategory) => void;
  onUpdateNotifications: (notifs: NotificationLog[]) => void;
  onToggleSidebar?: () => void;
  onSearchGlobal: (query: string) => void;
  globalQuery: string;
  onUpdateUserProfilePhoto?: (newPhotoUrl: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  appState,
  activeMenu,
  authUser,
  onLogout,
  onSelectMenu,
  onUpdateNotifications,
  onToggleSidebar,
  onSearchGlobal,
  globalQuery,
  onUpdateUserProfilePhoto,
}) => {
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const activeTA =
    appState.tahunAjaranList.find((t) => t.id === appState.activeTahunAjaranId) ||
    appState.tahunAjaranList.find((t) => t.isAktif) ||
    appState.tahunAjaranList[0];

  const unreadCount = appState.notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    const updated = appState.notifications.map((n) => ({ ...n, read: true }));
    onUpdateNotifications(updated);
  };

  const handleClearAll = () => {
    onUpdateNotifications([]);
  };

  const handleNotifClick = (notif: NotificationLog) => {
    const updated = appState.notifications.map((n) =>
      n.id === notif.id ? { ...n, read: true } : n
    );
    onUpdateNotifications(updated);

    if (notif.category === 'data-guru') onSelectMenu('data-guru');
    else if (notif.category === 'data-siswa') onSelectMenu('data-siswa');
    else if (notif.category === 'data-kelas') onSelectMenu('data-kelas');
    else if (notif.category === 'data-mapel') onSelectMenu('data-mapel');
    else if (notif.category === 'nilai') onSelectMenu('rekap-nilai');
    else if (notif.category === 'kelas9') onSelectMenu('cetak-skl');
    else if (notif.category === 'pengaturan') onSelectMenu('pengaturan-sekolah');

    setShowNotifPanel(false);
  };

  // Helper to extract initials
  const getUserInitials = (name?: string): string => {
    if (!name) return 'AD';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Role Checks & Permissions
  const isGuru = authUser?.role === 'guru';
  const displayName = authUser?.nama || 'Administrator';
  const displayRoleSubtitle = isGuru
    ? authUser?.nip
      ? `NIP. ${authUser.nip}`
      : 'Guru Pengampu'
    : 'Administrator Sistem';

  const currentGuru = isGuru
    ? appState.guruList.find(
        (g) =>
          g.id === authUser.guruId ||
          (authUser.nip && g.nip === authUser.nip) ||
          g.nama.toLowerCase() === authUser.nama.toLowerCase()
      )
    : null;

  // Resolved user photo URL
  const userPhotoUrl =
    authUser?.fotoUrl ||
    (isGuru
      ? currentGuru?.fotoUrl
      : appState.sekolah.adminFotoUrl ||
        appState.userAccounts?.find((a) => a.role === 'admin')?.fotoUrl);

  // Helper for Breadcrumb navigation
  const getMenuBreadcrumb = (menu: MenuCategory) => {
    switch (menu) {
      case 'dashboard':
        return { section: 'Utama', title: 'Dashboard' };
      case 'data-guru':
        return { section: 'Manajemen Data', title: 'Data Guru' };
      case 'data-kelas':
        return { section: 'Manajemen Data', title: 'Data Kelas' };
      case 'data-mapel':
        return { section: 'Manajemen Data', title: 'Data Mata Pelajaran' };
      case 'data-siswa':
        return { section: 'Manajemen Data', title: 'Data Siswa' };
      case 'input-nilai':
        return { section: 'Nilai Sumatif', title: 'Input Nilai Sumatif' };
      case 'rekap-nilai':
        return { section: 'Nilai Sumatif', title: 'Rekap Nilai Siswa' };
      case 'input-kelas9':
        return { section: 'Kelulusan K9', title: 'Input Nilai Kelas 9' };
      case 'cetak-sknr':
        return { section: 'Kelulusan K9', title: 'Cetak SKNR' };
      case 'cetak-skl':
        return { section: 'Kelulusan K9', title: 'Cetak Surat Keterangan Lulus' };
      case 'cetak-transkrip':
        return { section: 'Kelulusan K9', title: 'Cetak Transkrip Nilai' };
      case 'pengaturan-sekolah':
        return { section: 'Sistem', title: 'Profil & Pengaturan Sekolah' };
      case 'tahun-ajaran':
        return { section: 'Sistem', title: 'Manajemen Tahun Pelajaran' };
      case 'backup-restore':
        return { section: 'Sistem', title: 'Backup & Restore Database' };
      case 'ubah-password':
        return { section: 'Akun', title: 'Ubah Password Pengguna' };
      default:
        return { section: 'Portal', title: 'Penilaian Siswa' };
    }
  };

  const breadcrumb = getMenuBreadcrumb(activeMenu);

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs print:hidden">
        <div className="px-3 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-3">
            {/* Left Side: Mobile Hamburger Button & Active Menu Breadcrumb */}
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
              {/* Mobile Sidebar Toggle Button */}
              <button
                type="button"
                onClick={onToggleSidebar}
                className="p-2 text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded-xl md:hidden transition cursor-pointer shrink-0"
                title="Buka Navigasi Menu Samping"
              >
                <Menu size={20} />
              </button>

              {/* Breadcrumb Information */}
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 text-slate-500 text-[11px] font-medium truncate">
                  <span className="hidden sm:inline hover:text-slate-700">{breadcrumb.section}</span>
                  <ChevronRight size={12} className="hidden sm:inline text-slate-400" />
                  <span className="font-bold text-slate-900 truncate text-xs sm:text-sm">
                    {breadcrumb.title}
                  </span>
                </div>
                <div className="hidden md:flex items-center space-x-2 text-[10px] text-slate-400 font-medium">
                  <span>{appState.sekolah.namaSekolah || 'SMP Negeri 2 Kemranjen'}</span>
                  <span>•</span>
                  <span className="text-blue-600 font-semibold">
                    Semester {authUser?.semester || activeTA?.semester || 'Genap'} T.P{' '}
                    {authUser?.tahunAjaran || activeTA?.tahun || '2025/2026'}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Global Search Bar */}
            <div className="hidden lg:flex flex-1 max-w-sm xl:max-w-md mx-4">
              <div className="relative w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={globalQuery}
                  onChange={(e) => onSearchGlobal(e.target.value)}
                  placeholder="Cari data siswa, NISN, guru, mapel..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
                {globalQuery && (
                  <button
                    onClick={() => onSearchGlobal('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Right Side: Active Semester Tag, Notifications, User Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {/* Academic Year Badge (Hidden on mobile) */}
              <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200/80 text-blue-700 text-[11px] font-semibold">
                <Calendar size={13} className="text-blue-600 shrink-0" />
                <span>
                  {authUser?.tahunAjaran || activeTA?.tahun} ({authUser?.semester || activeTA?.semester})
                </span>
              </div>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifPanel(!showNotifPanel)}
                  className="relative p-2 text-slate-600 hover:text-blue-600 rounded-xl hover:bg-slate-100 transition-colors focus:outline-hidden cursor-pointer"
                  title="Notifikasi Aktivitas"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-white font-extrabold animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {showNotifPanel && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNotifPanel(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Bell size={15} className="text-blue-400" />
                          <h3 className="font-bold text-xs uppercase tracking-wider">
                            Notifikasi Sistem
                          </h3>
                          {unreadCount > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                              {unreadCount} baru
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowNotifPanel(false)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {appState.notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400">
                            <Info size={28} className="mx-auto mb-2 opacity-50" />
                            <p className="text-xs">Belum ada aktivitas baru.</p>
                          </div>
                        ) : (
                          appState.notifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => handleNotifClick(notif)}
                              className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start space-x-3 ${
                                !notif.read ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <div
                                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  !notif.read ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300'
                                }`}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-xs font-semibold text-slate-800 truncate">
                                    {notif.title}
                                  </h4>
                                  <span className="text-[10px] text-slate-400 shrink-0">
                                    {notif.timestamp}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                  {notif.message}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {appState.notifications.length > 0 && (
                        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                          <button
                            onClick={handleMarkAllRead}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 cursor-pointer"
                          >
                            <CheckCircle2 size={12} />
                            <span>Tandai Semua Dibaca</span>
                          </button>
                          <button
                            onClick={handleClearAll}
                            className="text-slate-400 hover:text-rose-600 font-medium flex items-center space-x-1 cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Bersihkan</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Vertical divider */}
              <div className="h-6 w-px bg-slate-200" />

              {/* User Profile Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center space-x-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 transition-colors focus:outline-hidden cursor-pointer group"
                >
                  <div
                    className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0 ${
                      isGuru
                        ? 'bg-indigo-600 ring-2 ring-indigo-500/20'
                        : 'bg-blue-600 ring-2 ring-blue-500/20'
                    }`}
                  >
                    {userPhotoUrl ? (
                      <img
                        src={userPhotoUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getUserInitials(displayName)
                    )}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight truncate max-w-[120px]">
                      {displayName}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight flex items-center space-x-1 mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full inline-block ${
                          isGuru ? 'bg-indigo-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span className="truncate max-w-[120px]">{displayRoleSubtitle}</span>
                    </p>
                  </div>
                </button>

                {/* User Dropdown Menu */}
                {showUserDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                      <div className="p-4 bg-slate-900 text-white relative">
                        <div className="flex items-center space-x-3">
                          <div className="relative shrink-0">
                            <div
                              className={`w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-white text-sm border-2 ${
                                isGuru
                                  ? 'bg-indigo-600 border-indigo-400'
                                  : 'bg-blue-600 border-blue-400'
                              }`}
                            >
                              {userPhotoUrl ? (
                                <img
                                  src={userPhotoUrl}
                                  alt={displayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                getUserInitials(displayName)
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setShowUserDropdown(false);
                                setShowPhotoModal(true);
                              }}
                              title="Ganti foto profil"
                              className="absolute -bottom-1 -right-1 p-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md border-2 border-slate-900 transition transform hover:scale-110 cursor-pointer"
                            >
                              <Camera size={10} />
                            </button>
                          </div>

                          <div className="overflow-hidden flex-1">
                            <p className="text-xs font-bold text-white truncate">
                              {displayName}
                            </p>
                            <p className="text-[11px] text-slate-300 truncate">
                              {isGuru ? 'Guru Pengampu' : 'Administrator Sistem'}
                            </p>
                            <span className="inline-block text-[9px] bg-white/20 px-2 py-0.5 rounded-full text-blue-200 mt-1 font-semibold">
                              {authUser?.tahunAjaran || activeTA?.tahun} ({authUser?.semester || activeTA?.semester})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 space-y-1 text-xs">
                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            setShowPhotoModal(true);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold transition cursor-pointer"
                        >
                          <Camera size={15} className="text-blue-600" />
                          <span>Ubah Foto Profil</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowUserDropdown(false);
                            onSelectMenu('ubah-password');
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-blue-50 hover:text-blue-700 font-semibold transition cursor-pointer"
                        >
                          <KeyRound size={15} className="text-blue-600" />
                          <span>Ganti Password</span>
                        </button>

                        {onLogout && (
                          <div className="pt-1 border-t border-slate-100">
                            <button
                              onClick={() => {
                                setShowUserDropdown(false);
                                onLogout();
                              }}
                              className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold transition cursor-pointer"
                            >
                              <LogOut size={15} />
                              <span>Keluar Sesi</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Photo Upload Modal */}
      {showPhotoModal && (
        <PhotoUploadModal
          currentPhotoUrl={userPhotoUrl}
          userName={displayName}
          onSavePhoto={(newPhotoUrl) => {
            if (onUpdateUserProfilePhoto) {
              onUpdateUserProfilePhoto(newPhotoUrl);
            }
            setShowPhotoModal(false);
          }}
          onClose={() => setShowPhotoModal(false)}
        />
      )}
    </>
  );
};
