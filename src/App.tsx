/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  AppState,
  MenuCategory,
  Guru,
  Kelas,
  Mapel,
  Siswa,
  NilaiSumatif,
  ClassSumatifConfig,
  NilaiKelas9,
  PengaturanSekolah as SchoolType,
  TahunAjaranConfig,
  NotificationLog,
  AuthUser,
  UserAccount,
} from './types';
import {
  loadAppState,
  saveAppState,
  resetAppState,
  loadAuthUser,
  saveAuthUser,
  createNotification,
} from './lib/storage';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { NotificationToast } from './components/NotificationToast';
import { LoginForm } from './components/auth/LoginForm';

// Views
import { Dashboard } from './components/dashboard/Dashboard';
import { DataGuru } from './components/data-management/DataGuru';
import { DataKelas } from './components/data-management/DataKelas';
import { DataMapel } from './components/data-management/DataMapel';
import { DataSiswa } from './components/data-management/DataSiswa';
import { InputNilai } from './components/nilai-sumatif/InputNilai';
import { RekapNilai } from './components/nilai-sumatif/RekapNilai';
import { InputNilaiKelas9 } from './components/analisis-kelas9/InputNilaiKelas9';
import { CetakSKNR } from './components/analisis-kelas9/CetakSKNR';
import { CetakSKL } from './components/analisis-kelas9/CetakSKL';
import { CetakTranskrip } from './components/analisis-kelas9/CetakTranskrip';
import { PengaturanSekolah } from './components/pengaturan/PengaturanSekolah';
import { TahunAjaran } from './components/pengaturan/TahunAjaran';
import { BackupRestore } from './components/pengaturan/BackupRestore';
import { UbahPassword } from './components/pengaturan/UbahPassword';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadAuthUser());
  const [activeMenu, setActiveMenu] = useState<MenuCategory>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [toastNotification, setToastNotification] = useState<NotificationLog | null>(null);

  // Auto-save state to localStorage on any change and sync document title
  useEffect(() => {
    saveAppState(appState);
    if (appState.sekolah?.namaSekolah) {
      document.title = `e-dafnil - ${appState.sekolah.namaSekolah}`;
    }
  }, [appState]);

  // Handle successful login
  const handleLoginSuccess = (user: AuthUser) => {
    setAuthUser(user);
    saveAuthUser(user);

    // Create a welcome notification
    const roleLabel = user.role === 'admin' ? 'Administrator' : 'Guru';
    const welcomeNotif = createNotification(
      'Sesi Masuk Berhasil',
      `Selamat datang kembali, ${user.nama}. Anda berhasil masuk sebagai ${roleLabel} pada Semester ${user.semester} T.P ${user.tahunAjaran}.`,
      'pengaturan',
      user.nama
    );

    setToastNotification(welcomeNotif);
    setAppState((prev) => ({
      ...prev,
      notifications: [welcomeNotif, ...prev.notifications],
    }));
  };

  // Handle logout
  const handleLogout = () => {
    setAuthUser(null);
    saveAuthUser(null);
    setActiveMenu('dashboard');
  };

  // Route protection for Guru
  useEffect(() => {
    if (authUser?.role === 'guru') {
      const restrictedAdminOnly: MenuCategory[] = [
        'data-guru',
        'data-kelas',
        'data-mapel',
        'data-siswa',
        'pengaturan-sekolah',
        'tahun-ajaran',
        'backup-restore',
      ];

      const currentGuru = appState.guruList.find(
        (g) =>
          g.id === authUser.guruId ||
          (authUser.nip && g.nip === authUser.nip) ||
          g.nama.toLowerCase() === authUser.nama.toLowerCase() ||
          g.nama.toLowerCase().includes(authUser.username.toLowerCase()) ||
          authUser.username.toLowerCase().includes(g.nama.toLowerCase().split(' ')[0])
      );

      const isWaliKelas = currentGuru
        ? appState.kelasList.some(
            (k) =>
              k.waliKelasId === currentGuru.id ||
              k.waliKelasNama?.toLowerCase() === currentGuru.nama.toLowerCase() ||
              (authUser?.nama && k.waliKelasNama?.toLowerCase().includes(authUser.nama.toLowerCase()))
          )
        : false;

      const isWaliKelas9 = currentGuru
        ? appState.kelasList.some((k) => {
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
        : false;

      // 1. Menu Analisis Kelas 9: hanya admin dan wali kelas 9 yang bisa akses
      const restrictedAnalisisKelas9Only: MenuCategory[] = [
        'input-kelas9',
        'cetak-sknr',
        'cetak-skl',
        'cetak-transkrip',
      ];

      // 2. Sub menu rekap nilai: hanya admin dan wali kelas yang bisa akses
      const restrictedRekapNilaiOnly: MenuCategory[] = ['rekap-nilai'];

      if (
        restrictedAdminOnly.includes(activeMenu) ||
        (!isWaliKelas && restrictedRekapNilaiOnly.includes(activeMenu)) ||
        (!isWaliKelas9 && restrictedAnalisisKelas9Only.includes(activeMenu))
      ) {
        setActiveMenu('input-nilai');
      }
    }
  }, [authUser, activeMenu, appState.guruList, appState.kelasList]);

  // Helper to append a notification and trigger toast
  const addNotificationAndToast = (
    currentState: AppState,
    newNotif: NotificationLog,
    updatedPartial: Partial<AppState>
  ) => {
    const updatedNotifications = [newNotif, ...currentState.notifications];
    setToastNotification(newNotif);
    setAppState({
      ...currentState,
      ...updatedPartial,
      notifications: updatedNotifications,
    });
  };

  // State Update Handlers
  const handleUpdateGuruList = (newList: Guru[], notif: NotificationLog) => {
    addNotificationAndToast(appState, notif, { guruList: newList });
  };

  const handleUpdateKelasList = (newList: Kelas[], notif: NotificationLog) => {
    addNotificationAndToast(appState, notif, { kelasList: newList });
  };

  const handleUpdateMapelList = (newList: Mapel[], notif: NotificationLog) => {
    addNotificationAndToast(appState, notif, { mapelList: newList });
  };

  const handleUpdateSiswaList = (newList: Siswa[], notif: NotificationLog) => {
    addNotificationAndToast(appState, notif, { siswaList: newList });
  };

  const handleUpdateNilaiSumatif = (
    newList: NilaiSumatif[],
    notif: NotificationLog,
    sumatifConfigByClass?: Record<string, ClassSumatifConfig>
  ) => {
    addNotificationAndToast(appState, notif, {
      nilaiSumatifList: newList,
      ...(sumatifConfigByClass ? { sumatifConfigByClass } : {}),
    });
  };

  const handleUpdateNilaiKelas9 = (newList: NilaiKelas9[], notif: NotificationLog) => {
    addNotificationAndToast(appState, notif, { nilaiKelas9List: newList });
  };

  const handleUpdateSekolah = (newSekolah: SchoolType, notif: NotificationLog) => {
    addNotificationAndToast(appState, notif, { sekolah: newSekolah });
  };

  const handleUpdateUserAccounts = (newAccounts: UserAccount[], notif: NotificationLog) => {
    addNotificationAndToast(appState, notif, { userAccounts: newAccounts });
  };

  const handleUpdateTahunAjaran = (
    newList: TahunAjaranConfig[],
    activeId: string,
    notif: NotificationLog
  ) => {
    addNotificationAndToast(appState, notif, {
      tahunAjaranList: newList,
      activeTahunAjaranId: activeId,
    });
  };

  const handleUpdateNotifications = (newNotifs: NotificationLog[]) => {
    setAppState((prev) => ({ ...prev, notifications: newNotifs }));
  };

  const handleRestoreData = (newState: AppState, notif: NotificationLog) => {
    const updatedNotifs = [notif, ...(newState.notifications || [])];
    setToastNotification(notif);
    setAppState({
      ...newState,
      notifications: updatedNotifs,
    });
  };

  const handleResetData = (notif: NotificationLog) => {
    const fresh = resetAppState();
    const updatedNotifs = [notif, ...fresh.notifications];
    setToastNotification(notif);
    setAppState({
      ...fresh,
      notifications: updatedNotifs,
    });
  };

  // Global search redirect
  const handleGlobalSearch = (query: string) => {
    setGlobalSearchQuery(query);
    if (query.trim() && activeMenu !== 'data-siswa' && activeMenu !== 'dashboard') {
      setActiveMenu('data-siswa');
    }
  };

  // Handler: Update profile photo for logged-in user (Admin or Guru)
  const handleUpdateUserProfilePhoto = (newPhotoUrl: string) => {
    if (!authUser) return;

    if (authUser.role === 'admin') {
      const updatedSekolah = { ...appState.sekolah, adminFotoUrl: newPhotoUrl };
      const existingAccounts = appState.userAccounts || [];
      const adminExists = existingAccounts.some((a) => a.role === 'admin');
      const updatedAccounts = adminExists
        ? existingAccounts.map((acc) =>
            acc.role === 'admin' ? { ...acc, fotoUrl: newPhotoUrl } : acc
          )
        : [
            ...existingAccounts,
            {
              id: 'acc-admin',
              role: 'admin' as const,
              username: 'admin',
              nama: 'Administrator',
              password: 'admin123456',
              fotoUrl: newPhotoUrl,
              updatedAt: new Date().toLocaleString('id-ID'),
            },
          ];

      const notif = createNotification(
        'Foto Profil Diperbarui',
        newPhotoUrl
          ? 'Foto profil Administrator berhasil diunggah.'
          : 'Foto profil Administrator telah dihapus.',
        'pengaturan',
        authUser.nama
      );

      const updatedUser: AuthUser = { ...authUser, fotoUrl: newPhotoUrl };
      setAuthUser(updatedUser);
      saveAuthUser(updatedUser);

      addNotificationAndToast(appState, notif, {
        sekolah: updatedSekolah,
        userAccounts: updatedAccounts,
      });
    } else {
      // Guru role
      const currentGuru = appState.guruList.find(
        (g) =>
          g.id === authUser.guruId ||
          (authUser.nip && g.nip === authUser.nip) ||
          g.nama.toLowerCase() === authUser.nama.toLowerCase()
      );

      const updatedGuruList = appState.guruList.map((g) =>
        g.id === currentGuru?.id || (authUser.nip && g.nip === authUser.nip)
          ? { ...g, fotoUrl: newPhotoUrl }
          : g
      );

      const existingAccounts = appState.userAccounts || [];
      const updatedAccounts = existingAccounts.map((acc) =>
        acc.role === 'guru' &&
        (acc.guruId === currentGuru?.id || (authUser.nip && acc.nip === authUser.nip))
          ? { ...acc, fotoUrl: newPhotoUrl }
          : acc
      );

      const notif = createNotification(
        'Foto Profil Diperbarui',
        newPhotoUrl
          ? `Foto profil ${authUser.nama} berhasil diunggah.`
          : `Foto profil ${authUser.nama} telah dihapus.`,
        'data-guru',
        authUser.nama
      );

      const updatedUser: AuthUser = { ...authUser, fotoUrl: newPhotoUrl };
      setAuthUser(updatedUser);
      saveAuthUser(updatedUser);

      addNotificationAndToast(appState, notif, {
        guruList: updatedGuruList,
        userAccounts: updatedAccounts,
      });
    }
  };

  // If user is not authenticated, show login form directly matching requested design
  if (!authUser) {
    return <LoginForm appState={appState} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex antialiased selection:bg-blue-500 selection:text-white">
      {/* Left Sidebar Navigation with Dropdown Submenus */}
      <Sidebar
        appState={appState}
        authUser={authUser}
        activeMenu={activeMenu}
        onSelectMenu={(menu) => {
          setActiveMenu(menu);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isOpenMobile={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
        onOpenPasswordModal={() => setActiveMenu('ubah-password')}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header */}
        <Header
          appState={appState}
          activeMenu={activeMenu}
          authUser={authUser}
          onLogout={handleLogout}
          onSelectMenu={(menu) => {
            setActiveMenu(menu);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onUpdateNotifications={handleUpdateNotifications}
          onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
          onSearchGlobal={handleGlobalSearch}
          globalQuery={globalSearchQuery}
          onUpdateUserProfilePhoto={handleUpdateUserProfilePhoto}
        />

        {/* Main Content View Container */}
        <div className="flex-1 w-full overflow-y-auto">
          <main className="w-full max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 pb-16 min-w-0">
          {activeMenu === 'dashboard' && (
            <Dashboard appState={appState} onSelectMenu={setActiveMenu} />
          )}

          {activeMenu === 'data-guru' && (
            <DataGuru appState={appState} onUpdateGuruList={handleUpdateGuruList} />
          )}

          {activeMenu === 'data-kelas' && (
            <DataKelas appState={appState} onUpdateKelasList={handleUpdateKelasList} />
          )}

          {activeMenu === 'data-mapel' && (
            <DataMapel appState={appState} onUpdateMapelList={handleUpdateMapelList} />
          )}

          {activeMenu === 'data-siswa' && (
            <DataSiswa
              appState={appState}
              onUpdateSiswaList={handleUpdateSiswaList}
              initialSearchQuery={globalSearchQuery}
            />
          )}

          {activeMenu === 'input-nilai' && (
            <InputNilai
              appState={appState}
              authUser={authUser}
              onUpdateNilaiSumatif={handleUpdateNilaiSumatif}
            />
          )}

          {activeMenu === 'rekap-nilai' && (
            <RekapNilai appState={appState} authUser={authUser} />
          )}

          {activeMenu === 'input-kelas9' && (
            <InputNilaiKelas9
              appState={appState}
              authUser={authUser}
              onUpdateNilaiKelas9={handleUpdateNilaiKelas9}
            />
          )}

          {activeMenu === 'cetak-sknr' && (
            <CetakSKNR appState={appState} authUser={authUser} />
          )}

          {activeMenu === 'cetak-skl' && (
            <CetakSKL appState={appState} authUser={authUser} />
          )}

          {activeMenu === 'cetak-transkrip' && (
            <CetakTranskrip
              appState={appState}
              authUser={authUser}
              onUpdateNilaiKelas9={handleUpdateNilaiKelas9}
              onUpdateSiswaList={handleUpdateSiswaList}
            />
          )}

          {activeMenu === 'pengaturan-sekolah' && (
            <PengaturanSekolah
              appState={appState}
              onUpdateSekolah={handleUpdateSekolah}
            />
          )}

          {activeMenu === 'tahun-ajaran' && (
            <TahunAjaran
              appState={appState}
              onUpdateTahunAjaran={handleUpdateTahunAjaran}
            />
          )}

          {activeMenu === 'backup-restore' && (
            <BackupRestore
              appState={appState}
              onRestoreData={handleRestoreData}
              onResetData={handleResetData}
            />
          )}

          {activeMenu === 'ubah-password' && (
            <UbahPassword
              appState={appState}
              authUser={authUser}
              onUpdateUserAccounts={handleUpdateUserAccounts}
            />
          )}

          {/* Application Footer */}
          <footer className="mt-12 py-6 border-t border-slate-200 text-center text-xs text-slate-500 font-medium print:hidden">
            Created by Tim IT {appState.sekolah.namaSekolah || 'SMP Negeri 2 Kemranjen'}
          </footer>
        </main>
      </div>
      </div>

      {/* Floating Admin Notification Toast */}
      <NotificationToast
        toast={toastNotification}
        onClose={() => setToastNotification(null)}
      />
    </div>
  );
}
