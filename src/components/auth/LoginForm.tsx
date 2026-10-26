import React, { useState } from 'react';
import { AppState, AuthUser } from '../../types';
import {
  LogIn,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  User,
  ChevronDown,
  ShieldCheck,
  GraduationCap,
  CalendarDays,
  ArrowUp,
} from 'lucide-react';

interface LoginFormProps {
  appState: AppState;
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ appState, onLoginSuccess }) => {
  const [role, setRole] = useState<'admin' | 'guru'>('admin');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState<boolean>(false);

  // School branding derived from Pengaturan Sekolah menu
  const schoolName = appState.sekolah?.namaSekolah || 'SMP Negeri 2 Kemranjen';
  const schoolLogo = appState.sekolah?.logoUrl || '/logo.png';
  const loginPhotoUrl = appState.sekolah?.fotoLoginUrl || '/depan.png';
  const schoolAddress = appState.sekolah?.alamat || '';
  const schoolCity = appState.sekolah?.kabupatenKota || '';

  // Academic year and semester from appState
  const activeTA =
    appState.tahunAjaranList?.find((t) => t.isAktif) || appState.tahunAjaranList?.[0];
  const defaultYearSemester = activeTA
    ? `${activeTA.tahun} - ${activeTA.semester}`
    : '2026/2027 - Ganjil';

  const [tahunSemester, setTahunSemester] = useState<string>(() => defaultYearSemester);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const checkCapsLock = (e: React.KeyboardEvent) => {
    if (typeof e.getModifierState === 'function') {
      setIsCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  // Available academic year & semester options derived from config + standards
  const configuredYears =
    appState.tahunAjaranList?.map((t) => `${t.tahun} - ${t.semester}`) || [];
  const standardOptions = [
    '2026/2027 - Ganjil',
    '2026/2027 - Genap',
    '2025/2026 - Ganjil',
    '2025/2026 - Genap',
    '2024/2025 - Ganjil',
    '2024/2025 - Genap',
  ];
  const academicYearOptions = Array.from(new Set([...configuredYears, ...standardOptions]));

  // Clear username & password when switching role
  const handleRoleChange = (newRole: 'admin' | 'guru') => {
    setRole(newRole);
    setErrorMessage(null);
    setUsername('');
    setPassword('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    setTimeout(() => {
      const cleanUsername = username.trim().toLowerCase();
      const cleanPassword = password.trim();

      // Split tahun & semester
      const [chosenTahun, chosenSemester] = tahunSemester.split(' - ') as [
        string,
        'Ganjil' | 'Genap'
      ];

      // 1. Check Administrator Login
      if (role === 'admin') {
        const adminAcc = appState.userAccounts?.find((a) => a.role === 'admin');
        const expectedAdminPass = adminAcc?.password || 'admin123456';

        if (cleanUsername === 'admin' && cleanPassword === expectedAdminPass) {
          const authUser: AuthUser = {
            role: 'admin',
            username: 'admin',
            nama: 'Administrator',
            tahunAjaran: chosenTahun || '2026/2027',
            semester: chosenSemester || 'Ganjil',
            loggedInAt: new Date().toISOString(),
          };
          onLoginSuccess(authUser);
          return;
        } else {
          setErrorMessage(
            'Username atau password Administrator salah!'
          );
          setIsLoading(false);
          return;
        }
      }

      // 2. Check Guru Login
      if (role === 'guru') {
        // Find teacher by NIP or name in guruList
        const matchedGuru = appState.guruList.find(
          (g) =>
            g.nip.trim() === username.trim() ||
            g.nama.toLowerCase() === cleanUsername ||
            g.nama.toLowerCase().includes(cleanUsername) ||
            cleanUsername.includes(g.nama.toLowerCase().split(' ')[0])
        );

        // Find teacher account in userAccounts
        const guruAcc = appState.userAccounts?.find(
          (a) =>
            a.role === 'guru' &&
            (a.guruId === matchedGuru?.id ||
              a.nip === username.trim() ||
              a.username.toLowerCase() === cleanUsername)
        );

        const expectedGuruPass = guruAcc?.password || 'guru123456';

        if (cleanPassword !== expectedGuruPass) {
          setErrorMessage(
            'Password Guru salah!'
          );
          setIsLoading(false);
          return;
        }

        if (matchedGuru) {
          const authUser: AuthUser = {
            role: 'guru',
            username: username.trim(),
            nama: matchedGuru.nama,
            nip: matchedGuru.nip,
            guruId: matchedGuru.id,
            tahunAjaran: chosenTahun || '2026/2027',
            semester: chosenSemester || 'Ganjil',
            loggedInAt: new Date().toISOString(),
          };
          onLoginSuccess(authUser);
          return;
        } else {
          if (cleanUsername.length >= 2) {
            const authUser: AuthUser = {
              role: 'guru',
              username: username.trim(),
              nama: username.trim().toUpperCase(),
              nip: /^\d+$/.test(username.trim()) ? username.trim() : undefined,
              tahunAjaran: chosenTahun || '2026/2027',
              semester: chosenSemester || 'Ganjil',
              loggedInAt: new Date().toISOString(),
            };
            onLoginSuccess(authUser);
            return;
          } else {
            setErrorMessage(
              'Masukkan NIP atau nama guru dengan benar.'
            );
            setIsLoading(false);
            return;
          }
        }
      }

      setErrorMessage('Terjadi kesalahan pada data autentikasi.');
      setIsLoading(false);
    }, 250);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden select-none font-sans bg-slate-950">
      {/* School Courtyard Background Image with Smooth Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: `url('${loginPhotoUrl}'), url('/depan.png'), url('/logo.png')`,
        }}
      >
        {/* Dark Gradient Overlay for Maximum Readability and Aesthetic School Mood */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/75 to-slate-900/60 lg:bg-gradient-to-r lg:from-slate-950/80 lg:via-slate-950/60 lg:to-slate-950/85" />
        
        {/* Ambient Color Glow Accents */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main Content Area - Split Layout on Desktop, Right Aligned Login */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12 my-auto flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
        
        {/* Left Side: School Branding & Portal Identity (Visible prominently on LG screens) */}
        <div className="w-full lg:max-w-xl text-white space-y-5 hidden lg:block text-left">
          <div className="inline-flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-blue-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistem Informasi Penilaian & Kelulusan</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-4">
              <img
                src={schoolLogo}
                alt={`Logo ${schoolName}`}
                className="w-16 h-16 xl:w-20 xl:h-20 object-contain drop-shadow-md shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo-smpn2kemranjen.svg';
                }}
              />
              <h1 className="text-3xl xl:text-4xl font-black tracking-tight leading-tight drop-shadow-md">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
                  {schoolName}
                </span>
              </h1>
            </div>
            <p className="text-sm xl:text-base text-slate-200 font-medium leading-relaxed drop-shadow-sm max-w-lg">
              Portal terpadu pengolahan nilai sumatif, analisis kelulusan kelas 9, dan pencetakan SKNR-SKL-TRANSKRIP.
            </p>
          </div>

          {/* School Photo Showcase */}
          <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-slate-950/80 bg-slate-900/60 backdrop-blur-md group">
            <img
              src={loginPhotoUrl}
              alt={schoolName}
              className="w-full h-44 xl:h-52 object-cover transition-transform duration-700 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = schoolLogo;
                target.className = 'w-full h-28 object-contain p-4 opacity-70';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />
            <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between text-xs text-white">
              <span className="font-semibold text-slate-200 drop-shadow-sm truncate">
                {schoolName}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl">
              <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">Tahun Pelajaran</div>
              <div className="text-base font-extrabold text-white mt-0.5">
                {activeTA?.tahun || '2026/2027'}
              </div>
              <div className="text-[11px] text-slate-400">
                Semester {activeTA?.semester || 'Ganjil'}
              </div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl">
              <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Status Portal</div>
              <div className="text-base font-extrabold text-white mt-0.5">Online & Siap</div>
              <div className="text-[11px] text-slate-400">Kurikulum Merdeka</div>
            </div>
          </div>
        </div>

        {/* Right Side: Login Card (Shifted to the Right) */}
        <div className="w-full max-w-[440px] lg:ml-auto bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-950/60 border border-white/80 transition-all">
          {/* Logo & School Header */}
          <div className="flex flex-col items-center mb-5 text-center">
            <div className="relative mb-3">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl blur-xs opacity-75 animate-pulse" />
              <div className="relative w-16 h-16 bg-white rounded-2xl border border-slate-200 shadow-xl flex items-center justify-center p-2">
                <img
                  src={schoolLogo}
                  alt={`Logo ${schoolName}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo-smpn2kemranjen.svg';
                  }}
                />
              </div>
            </div>

            {/* School Name matching Pengaturan Menu */}
            <div className="w-full px-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-blue-700 leading-tight">
                {schoolName}
              </h2>
              <span className="text-[10px] sm:text-[11px] font-extrabold tracking-widest text-slate-600 uppercase block mt-1">
                Portal Penilaian Siswa
              </span>
              {schoolCity ? (
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {schoolCity}
                </p>
              ) : schoolAddress ? (
                <p className="text-xs font-medium text-slate-500 mt-0.5 line-clamp-1">
                  {schoolAddress}
                </p>
              ) : null}
            </div>
          </div>

          {/* Mobile School Photo Banner (< lg) */}
          <div className="lg:hidden w-full mb-4 rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm relative h-32 sm:h-36 group">
            <img
              src={loginPhotoUrl}
              alt={schoolName}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = schoolLogo;
                target.className = 'w-full h-full object-contain p-3 opacity-60';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-white">
              <span className="font-bold text-white text-xs drop-shadow-sm truncate">
                {schoolName}
              </span>
            </div>
          </div>

          {/* Dynamic Role Selector Tabs */}
          <div className="mb-4 bg-slate-100/90 p-1 rounded-2xl flex border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleRoleChange('admin')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                role === 'admin'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <ShieldCheck size={15} />
              <span>Administrator</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('guru')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                role === 'guru'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <GraduationCap size={15} />
              <span>Guru Pengampu</span>
            </button>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start space-x-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            {/* Username */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User size={16} />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={checkCapsLock}
                  onKeyUp={checkCapsLock}
                  placeholder={role === 'admin' ? 'Masukkan username admin' : 'Masukkan NIP atau nama guru'}
                  autoComplete="off"
                  required
                  className="w-full text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl pl-9 pr-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition shadow-xs"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                {isCapsLockOn && (
                  <span
                    id="capslock-indicator"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md animate-pulse"
                    title="Caps Lock sedang aktif. Periksa huruf besar/kecil password Anda."
                  >
                    <ArrowUp size={11} className="stroke-[3]" />
                    <span>Caps Lock Aktif</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={checkCapsLock}
                  onKeyUp={checkCapsLock}
                  onBlur={() => setIsCapsLockOn(false)}
                  placeholder="Masukkan password"
                  required
                  className="w-full text-xs sm:text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl pl-9 pr-11 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition p-1 cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Tahun Ajaran / Semester */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Tahun Ajaran / Semester
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <CalendarDays size={16} />
                </div>
                <select
                  id="login-tahun-semester"
                  value={tahunSemester}
                  onChange={(e) => setTahunSemester(e.target.value)}
                  className="w-full appearance-none text-xs sm:text-sm font-semibold text-slate-800 bg-white border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition shadow-xs cursor-pointer"
                >
                  {academicYearOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
              </div>
            </div>

            {/* Submit Button with Vibrant Gradient */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition-all transform active:scale-[0.99] cursor-pointer disabled:opacity-75"
              >
                <LogIn size={18} />
                <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Portal'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-300/80 font-medium bg-slate-950/40 backdrop-blur-xs border-t border-white/5">
        Created by Tim IT {schoolName} &bull; Portal Penilaian Siswa v1.1
      </footer>
    </div>
  );
};
