import React, { useState } from 'react';
import { AppState, AuthUser, Guru, NotificationLog, UserAccount } from '../../types';
import { createNotification } from '../../lib/storage';
import {
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  GraduationCap,
  RotateCcw,
  Search,
  User,
  Check,
  X,
  AlertTriangle,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface UbahPasswordProps {
  appState: AppState;
  authUser: AuthUser;
  onUpdateUserAccounts: (newAccounts: UserAccount[], notif: NotificationLog) => void;
  onCloseModal?: () => void;
  isModal?: boolean;
}

export const UbahPassword: React.FC<UbahPasswordProps> = ({
  appState,
  authUser,
  onUpdateUserAccounts,
  onCloseModal,
  isModal = false,
}) => {
  const isAdmin = authUser.role === 'admin';

  // Active Tab: 'my-password' or 'manage-guru'
  const [activeTab, setActiveTab] = useState<'my-password' | 'manage-guru'>('my-password');

  // Form State: Change My Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [selfError, setSelfError] = useState<string | null>(null);
  const [selfSuccess, setSelfSuccess] = useState<string | null>(null);

  // Search state for Guru management tab
  const [searchGuruQuery, setSearchGuruQuery] = useState('');

  // Modal State for Admin setting specific Guru password
  const [editingGuruAccount, setEditingGuruAccount] = useState<Guru | null>(null);
  const [adminSetPassValue, setAdminSetPassValue] = useState('');
  const [showAdminSetPass, setShowAdminSetPass] = useState(false);
  const [adminSetError, setAdminSetError] = useState<string | null>(null);

  // Reset Guru Modal confirmation
  const [resetConfirmGuru, setResetConfirmGuru] = useState<Guru | null>(null);
  const [resetAllConfirmOpen, setResetAllConfirmOpen] = useState(false);

  // Helper to get current account for logged in user
  const getUserCurrentAccount = (): UserAccount | undefined => {
    if (isAdmin) {
      return (
        appState.userAccounts?.find((a) => a.role === 'admin') || {
          id: 'acc-admin',
          role: 'admin',
          username: 'admin',
          nama: 'Administrator',
          password: 'admin123456',
          updatedAt: '2026-08-15 08:00',
        }
      );
    } else {
      // Guru user
      const matched = appState.userAccounts?.find(
        (a) =>
          a.role === 'guru' &&
          (a.guruId === authUser.guruId ||
            (authUser.nip && a.nip === authUser.nip) ||
            a.username.toLowerCase() === authUser.username.toLowerCase())
      );
      if (matched) return matched;

      // Fallback virtual account
      return {
        id: `acc-${authUser.guruId || authUser.username}`,
        role: 'guru',
        username: authUser.nip || authUser.username,
        nama: authUser.nama,
        guruId: authUser.guruId,
        nip: authUser.nip,
        password: 'guru123456',
        updatedAt: '2026-08-15 08:00',
      };
    }
  };

  // Handler: Change My Password
  const handleSaveMyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setSelfError(null);
    setSelfSuccess(null);

    const userAcc = getUserCurrentAccount();
    const storedPass = userAcc?.password || (isAdmin ? 'admin123456' : 'guru123456');

    // Validation
    if (!currentPassword) {
      setSelfError('Harap masukkan password saat ini.');
      return;
    }
    if (currentPassword !== storedPass) {
      setSelfError('Password saat ini (lama) tidak sesuai!');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setSelfError('Password baru minimal terdiri dari 6 karakter.');
      return;
    }
    if (newPassword === currentPassword) {
      setSelfError('Password baru tidak boleh sama dengan password saat ini.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSelfError('Konfirmasi password baru tidak cocok.');
      return;
    }

    const nowStr = new Date().toLocaleString('id-ID');
    const existingAccounts = appState.userAccounts ? [...appState.userAccounts] : [];

    let updatedAccounts: UserAccount[];

    if (isAdmin) {
      const adminIdx = existingAccounts.findIndex((a) => a.role === 'admin');
      const updatedAdmin: UserAccount = {
        id: 'acc-admin',
        role: 'admin',
        username: 'admin',
        nama: 'Administrator',
        password: newPassword,
        updatedAt: nowStr,
      };

      if (adminIdx >= 0) {
        existingAccounts[adminIdx] = updatedAdmin;
        updatedAccounts = existingAccounts;
      } else {
        updatedAccounts = [updatedAdmin, ...existingAccounts];
      }
    } else {
      // Guru update
      const guruIdx = existingAccounts.findIndex(
        (a) =>
          a.role === 'guru' &&
          (a.guruId === authUser.guruId ||
            (authUser.nip && a.nip === authUser.nip) ||
            a.username.toLowerCase() === authUser.username.toLowerCase())
      );

      const updatedGuru: UserAccount = {
        id: userAcc?.id || `acc-${authUser.guruId || Date.now()}`,
        role: 'guru',
        username: authUser.nip || authUser.username,
        nama: authUser.nama,
        guruId: authUser.guruId,
        nip: authUser.nip,
        password: newPassword,
        updatedAt: nowStr,
      };

      if (guruIdx >= 0) {
        existingAccounts[guruIdx] = updatedGuru;
        updatedAccounts = existingAccounts;
      } else {
        updatedAccounts = [...existingAccounts, updatedGuru];
      }
    }

    const notif = createNotification(
      'Ubah Password Berhasil',
      `Password untuk akun ${authUser.nama} (${isAdmin ? 'Administrator' : 'Guru'}) berhasil diperbarui pada ${nowStr}.`,
      'pengaturan',
      authUser.nama
    );

    onUpdateUserAccounts(updatedAccounts, notif);

    setSelfSuccess('Password Anda berhasil diperbarui! Silakan gunakan password baru ini pada sesi masuk berikutnya.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Helper to get specific guru account
  const getGuruAccount = (guru: Guru): UserAccount | undefined => {
    return appState.userAccounts?.find(
      (a) => a.role === 'guru' && (a.guruId === guru.id || a.nip === guru.nip)
    );
  };

  // Handler: Admin sets password for a specific guru
  const handleAdminSaveGuruPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuruAccount) return;
    setAdminSetError(null);

    if (!adminSetPassValue || adminSetPassValue.length < 6) {
      setAdminSetError('Password baru minimal terdiri dari 6 karakter.');
      return;
    }

    const nowStr = new Date().toLocaleString('id-ID');
    const existingAccounts = appState.userAccounts ? [...appState.userAccounts] : [];

    const guruIdx = existingAccounts.findIndex(
      (a) =>
        a.role === 'guru' &&
        (a.guruId === editingGuruAccount.id || a.nip === editingGuruAccount.nip)
    );

    const updatedGuruAcc: UserAccount = {
      id: `acc-${editingGuruAccount.id}`,
      role: 'guru',
      username: editingGuruAccount.nip,
      nama: editingGuruAccount.nama,
      guruId: editingGuruAccount.id,
      nip: editingGuruAccount.nip,
      password: adminSetPassValue,
      updatedAt: nowStr,
    };

    let updatedAccounts: UserAccount[];
    if (guruIdx >= 0) {
      existingAccounts[guruIdx] = updatedGuruAcc;
      updatedAccounts = existingAccounts;
    } else {
      updatedAccounts = [...existingAccounts, updatedGuruAcc];
    }

    const notif = createNotification(
      'Pembaruan Password Guru',
      `Password untuk guru ${editingGuruAccount.nama} (NIP: ${editingGuruAccount.nip}) berhasil diubah oleh Administrator.`,
      'pengaturan',
      'Administrator'
    );

    onUpdateUserAccounts(updatedAccounts, notif);
    setEditingGuruAccount(null);
    setAdminSetPassValue('');
  };

  // Handler: Admin resets specific guru password to 'guru123456'
  const handleConfirmResetGuruPassword = () => {
    if (!resetConfirmGuru) return;

    const nowStr = new Date().toLocaleString('id-ID');
    const existingAccounts = appState.userAccounts ? [...appState.userAccounts] : [];

    const guruIdx = existingAccounts.findIndex(
      (a) =>
        a.role === 'guru' &&
        (a.guruId === resetConfirmGuru.id || a.nip === resetConfirmGuru.nip)
    );

    const defaultGuruAcc: UserAccount = {
      id: `acc-${resetConfirmGuru.id}`,
      role: 'guru',
      username: resetConfirmGuru.nip,
      nama: resetConfirmGuru.nama,
      guruId: resetConfirmGuru.id,
      nip: resetConfirmGuru.nip,
      password: 'guru123456',
      updatedAt: nowStr,
    };

    let updatedAccounts: UserAccount[];
    if (guruIdx >= 0) {
      existingAccounts[guruIdx] = defaultGuruAcc;
      updatedAccounts = existingAccounts;
    } else {
      updatedAccounts = [...existingAccounts, defaultGuruAcc];
    }

    const notif = createNotification(
      'Reset Password Guru',
      `Password guru ${resetConfirmGuru.nama} telah direset ke default ('guru123456').`,
      'pengaturan',
      'Administrator'
    );

    onUpdateUserAccounts(updatedAccounts, notif);
    setResetConfirmGuru(null);
  };

  // Handler: Admin resets ALL guru passwords to 'guru123456'
  const handleConfirmResetAllGuru = () => {
    const nowStr = new Date().toLocaleString('id-ID');
    const existingAdmin = appState.userAccounts?.find((a) => a.role === 'admin') || {
      id: 'acc-admin',
      role: 'admin' as const,
      username: 'admin',
      nama: 'Administrator',
      password: 'admin123456',
      updatedAt: nowStr,
    };

    const resetGuruAccounts: UserAccount[] = appState.guruList.map((g) => ({
      id: `acc-${g.id}`,
      role: 'guru' as const,
      username: g.nip,
      nama: g.nama,
      guruId: g.id,
      nip: g.nip,
      password: 'guru123456',
      updatedAt: nowStr,
    }));

    const updatedAccounts = [existingAdmin, ...resetGuruAccounts];

    const notif = createNotification(
      'Reset Massal Password Guru',
      `Seluruh password guru (${appState.guruList.length} guru) berhasil di-reset kembali ke default 'guru123456'.`,
      'pengaturan',
      'Administrator'
    );

    onUpdateUserAccounts(updatedAccounts, notif);
    setResetAllConfirmOpen(false);
  };

  // Filtered Guru List
  const filteredGuruList = appState.guruList.filter((g) => {
    const query = searchGuruQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      g.nama.toLowerCase().includes(query) ||
      g.nip.toLowerCase().includes(query) ||
      g.email.toLowerCase().includes(query)
    );
  });

  const currentUserAcc = getUserCurrentAccount();

  return (
    <div className={`${isModal ? 'p-1' : 'p-4 md:p-6 max-w-5xl mx-auto'} space-y-6 animate-fadeIn`}>
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <KeyRound size={20} />
            </div>
            <span>Ubah Password Pengguna</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola kata sandi akun Anda dan akses pengguna untuk memastikan keamanan sistem e-DAFNIL.
          </p>
        </div>

        {isModal && onCloseModal && (
          <button
            onClick={onCloseModal}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer self-start sm:self-auto"
            title="Tutup Modal"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Tab Navigation (Tabs are visible for Admin; Guru only has Tab 1) */}
      {isAdmin && (
        <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200/80 max-w-md">
          <button
            type="button"
            onClick={() => setActiveTab('my-password')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'my-password'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock size={15} />
            <span>Password Akun Saya</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage-guru')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'manage-guru'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap size={16} />
            <span>Kelola Password Guru</span>
          </button>
        </div>
      )}

      {/* TAB 1: UBAH PASSWORD AKUN SAYA */}
      {(activeTab === 'my-password' || !isAdmin) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile Summary Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 lg:col-span-1 h-fit">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <User size={18} className="text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Informasi Akun Anda</h3>
            </div>

            <div className="flex items-center space-x-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm ${
                  isAdmin ? 'bg-slate-800' : 'bg-indigo-600'
                }`}
              >
                {isAdmin ? <ShieldCheck size={24} /> : <GraduationCap size={24} />}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-900 truncate">{authUser.nama}</h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isAdmin ? 'Administrator' : `NIP. ${authUser.nip || authUser.username}`}
                </p>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {isAdmin ? 'Hak Akses Penuh' : 'Guru Pengampu'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Username Login:</span>
                <span className="font-mono font-bold text-slate-800">{authUser.username}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Tahun / Semester:</span>
                <span className="font-semibold text-slate-800">
                  {authUser.tahunAjaran} ({authUser.semester})
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Terakhir Diubah:</span>
                <span className="font-semibold text-slate-700 text-[11px]">
                  {currentUserAcc?.updatedAt || 'Belum Pernah'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 leading-relaxed space-y-1">
              <div className="font-bold flex items-center space-x-1">
                <Info size={13} className="text-blue-600" />
                <span>Tips Keamanan:</span>
              </div>
              <p className="text-blue-800">
                Gunakan kombinasi minimal 6 karakter. Hindari menggunakan tanggal lahir atau nomor telepon yang mudah ditebak.
              </p>
            </div>
          </div>

          {/* Form Card: Ubah Password */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5 lg:col-span-2">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Lock size={18} className="text-blue-600" />
              <h3 className="text-sm font-extrabold text-slate-900">Formulir Ganti Password</h3>
            </div>

            {/* Error Message */}
            {selfError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2.5 animate-fadeIn">
                <AlertCircle size={17} className="shrink-0 text-rose-600" />
                <span>{selfError}</span>
              </div>
            )}

            {/* Success Message */}
            {selfSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2.5 animate-fadeIn">
                <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />
                <span>{selfSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveMyPassword} className="space-y-4">
              {/* Password Saat Ini */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password Saat Ini (Lama) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Masukkan password saat ini"
                    className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                    title={showCurrentPass ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Password Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                    title={showNewPass ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-1.5 flex items-center space-x-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          newPassword.length < 6
                            ? 'w-1/4 bg-rose-500'
                            : newPassword.length < 9
                            ? 'w-2/3 bg-amber-500'
                            : 'w-full bg-emerald-500'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {newPassword.length < 6
                        ? 'Terlalu pendek'
                        : newPassword.length < 9
                        ? 'Sedang'
                        : 'Kuat'}
                    </span>
                  </div>
                )}
              </div>

              {/* Konfirmasi Password Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Konfirmasi Password Baru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password baru"
                    className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                    title={showConfirmPass ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && (
                  <p
                    className={`text-[10px] mt-1 font-bold ${
                      confirmPassword === newPassword ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {confirmPassword === newPassword
                      ? '✓ Konfirmasi password cocok'
                      : '✗ Konfirmasi password belum cocok'}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setSelfError(null);
                    setSelfSuccess(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check size={16} />
                  <span>Simpan Perubahan Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: KELOLA PASSWORD GURU (KHUSUS ADMINISTRATOR) */}
      {isAdmin && activeTab === 'manage-guru' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                <GraduationCap size={18} className="text-indigo-600" />
                <span>Daftar Akun Guru & Kata Sandi</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Administrator dapat mengatur ulang password guru yang lupa atau menetapkan password baru.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setResetAllConfirmOpen(true)}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition flex items-center space-x-1.5 cursor-pointer"
                title="Reset password seluruh guru kembali ke guru123456"
              >
                <RotateCcw size={14} />
                <span>Reset Semua Guru (Default)</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchGuruQuery}
              onChange={(e) => setSearchGuruQuery(e.target.value)}
              placeholder="Cari nama guru atau NIP..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          {/* Guru List Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Nama Guru</th>
                  <th className="p-3">NIP / Username</th>
                  <th className="p-3">Status Password</th>
                  <th className="p-3">Terakhir Diperbarui</th>
                  <th className="p-3 text-center w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredGuruList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      Tidak ada data guru yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredGuruList.map((g, idx) => {
                    const acc = getGuruAccount(g);
                    const isDefault = !acc || acc.password === 'guru123456';

                    return (
                      <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{g.nama}</div>
                          <div className="text-[10px] text-slate-400">{g.email || '-'}</div>
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-700">{g.nip}</td>
                        <td className="p-3">
                          {isDefault ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Default (guru123456)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Kustom (Diubah)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-500 font-medium text-[11px]">
                          {acc?.updatedAt || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => {
                                setEditingGuruAccount(g);
                                setAdminSetPassValue(acc?.password || 'guru123456');
                                setAdminSetError(null);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                              title="Set Password Baru untuk Guru ini"
                            >
                              <KeyRound size={12} />
                              <span>Set Password</span>
                            </button>
                            <button
                              onClick={() => setResetConfirmGuru(g)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer"
                              title="Reset Password ke default (guru123456)"
                            >
                              <RotateCcw size={12} />
                              <span>Reset</span>
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
      )}

      {/* MODAL: Admin Set Password for Specific Guru */}
      {editingGuruAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                  <KeyRound size={17} className="text-indigo-600" />
                  <span>Set Password Guru</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingGuruAccount.nama} (NIP: {editingGuruAccount.nip})
                </p>
              </div>
              <button
                onClick={() => setEditingGuruAccount(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {adminSetError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{adminSetError}</span>
              </div>
            )}

            <form onSubmit={handleAdminSaveGuruPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Password Baru Guru <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showAdminSetPass ? 'text' : 'password'}
                    value={adminSetPassValue}
                    onChange={(e) => setAdminSetPassValue(e.target.value)}
                    placeholder="Masukkan password baru"
                    className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminSetPass(!showAdminSetPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                  >
                    {showAdminSetPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Minimal 6 karakter. Guru bersangkutan dapat langsung login dengan password ini.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGuruAccount(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Check size={15} />
                  <span>Simpan Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Reset Satu Guru */}
      {resetConfirmGuru && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <RotateCcw size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Reset Password Guru ke Default?
              </h3>
              <p className="text-xs text-slate-500">
                Password untuk <strong className="text-slate-800">{resetConfirmGuru.nama}</strong> akan dikembalikan menjadi <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-bold font-mono">guru123456</code>.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmGuru(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetGuruPassword}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition cursor-pointer"
              >
                Ya, Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Reset Semua Guru */}
      {resetAllConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <ShieldAlert size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Reset Massal Seluruh Password Guru?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tindakan ini akan mengembalikan seluruh kata sandi ({appState.guruList.length} guru) menjadi default <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-bold font-mono">guru123456</code>.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResetAllConfirmOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmResetAllGuru}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20 transition cursor-pointer"
              >
                Ya, Reset Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
