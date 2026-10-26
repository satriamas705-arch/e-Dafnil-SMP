import React, { useRef, useState } from 'react';
import { AppState, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { generateSqlDump, parseSqlDump, SqlParseResult } from '../../lib/sqlBackup';
import {
  Database,
  DatabaseBackup,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileCode2,
  FileJson,
  Eye,
  Copy,
  Check,
  Table2,
  X,
  School,
  Users,
  GraduationCap,
  BookOpen,
  FileSpreadsheet,
  Award,
  KeyRound,
  Calendar,
} from 'lucide-react';

interface BackupRestoreProps {
  appState: AppState;
  onRestoreData: (newState: AppState, notif: NotificationLog) => void;
  onResetData: (notif: NotificationLog) => void;
}

export const BackupRestore: React.FC<BackupRestoreProps> = ({
  appState,
  onRestoreData,
  onResetData,
}) => {
  const [activeTab, setActiveTab] = useState<'sql' | 'json' | 'reset'>('sql');

  // SQL File inputs and states
  const sqlFileInputRef = useRef<HTMLInputElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const [msgSuccess, setMsgSuccess] = useState<string>('');
  const [msgError, setMsgError] = useState<string>('');

  // Modals
  const [showSqlViewerModal, setShowSqlViewerModal] = useState(false);
  const [generatedSqlPreview, setGeneratedSqlPreview] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Restore SQL Confirmation Modal
  const [pendingSqlRestore, setPendingSqlRestore] = useState<{
    fileName: string;
    fileSizeKb: number;
    parseResult: SqlParseResult;
  } | null>(null);

  // Reset Confirmation Modal
  const [showResetModal, setShowResetModal] = useState(false);

  // Statistics from current appState
  const totalSiswa = appState.siswaList?.length || 0;
  const totalGuru = appState.guruList?.length || 0;
  const totalKelas = appState.kelasList?.length || 0;
  const totalMapel = appState.mapelList?.length || 0;
  const totalNilaiSumatif = appState.nilaiSumatifList?.length || 0;
  const totalNilaiK9 = appState.nilaiKelas9List?.length || 0;
  const totalAkun = appState.userAccounts?.length || 0;

  // -------------------------------------------------------------
  // 1. SQL EXPORT (BACKUP .SQL)
  // -------------------------------------------------------------
  const handleExportSqlBackup = () => {
    try {
      const sqlContent = generateSqlDump(appState);
      const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const downloadAnchor = document.createElement('a');
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const filename = `backup_sipenis_smpn2kemranjen_${dateStr}_${timeStr}.sql`;

      downloadAnchor.setAttribute('href', url);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      setMsgSuccess(`File backup SQL "${filename}" berhasil diunduh.`);
      setMsgError('');
    } catch (err: any) {
      setMsgError(`Gagal membuat file SQL: ${err.message || 'Kesalahan sistem'}`);
      setMsgSuccess('');
    }
  };

  // Preview SQL in Modal
  const handleOpenSqlPreview = () => {
    try {
      const dump = generateSqlDump(appState);
      setGeneratedSqlPreview(dump);
      setCopiedSql(false);
      setShowSqlViewerModal(true);
    } catch (err: any) {
      setMsgError(`Gagal membuat pratinjau SQL: ${err.message}`);
    }
  };

  const handleCopySqlToClipboard = async () => {
    if (!generatedSqlPreview) return;
    try {
      await navigator.clipboard.writeText(generatedSqlPreview);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // -------------------------------------------------------------
  // 2. SQL IMPORT (RESTORE .SQL)
  // -------------------------------------------------------------
  const handleSelectSqlFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const sqlText = event.target?.result as string;
        const result = parseSqlDump(sqlText, appState);

        if (!result.success || !result.data) {
          setMsgError(result.error || 'File SQL tidak dapat diproses.');
          setMsgSuccess('');
          return;
        }

        // Open inspection & confirmation dialog
        setPendingSqlRestore({
          fileName: file.name,
          fileSizeKb,
          parseResult: result,
        });
        setMsgError('');
      } catch (err: any) {
        setMsgError(`Gagal membaca file SQL: ${err.message || 'Format tidak valid'}`);
        setMsgSuccess('');
      }
    };

    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleConfirmSqlRestore = () => {
    if (!pendingSqlRestore || !pendingSqlRestore.parseResult.data) return;

    try {
      const dataToRestore = pendingSqlRestore.parseResult.data;
      const stats = pendingSqlRestore.parseResult.stats;

      const notif = createNotification(
        'Restore Database SQL Berhasil',
        `Database berhasil dipulihkan dari file SQL "${pendingSqlRestore.fileName}" (${stats?.siswaCount || 0} siswa, ${stats?.guruCount || 0} guru, ${stats?.nilaiSumatifCount || 0} nilai).`,
        'pengaturan'
      );

      onRestoreData(dataToRestore, notif);
      setMsgSuccess(`Database berhasil dipulihkan dari file SQL "${pendingSqlRestore.fileName}".`);
      setMsgError('');
      setPendingSqlRestore(null);
    } catch (err: any) {
      setMsgError(`Gagal menerapkan pemulihan database: ${err.message}`);
      setPendingSqlRestore(null);
    }
  };

  // -------------------------------------------------------------
  // 3. JSON EXPORT & IMPORT (ORIGINAL FALLBACK)
  // -------------------------------------------------------------
  const handleExportJsonBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `backup_penilaian_siswa_${dateStr}.json`;
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setMsgSuccess(`Backup database berhasil diunduh dalam format JSON (${filename}).`);
    setMsgError('');
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);

        if (!parsed.sekolah || !parsed.siswaList || !parsed.guruList) {
          throw new Error('Format file backup JSON tidak lengkap atau tidak valid.');
        }

        const notif = createNotification(
          'Restore Database JSON Berhasil',
          `Database berhasil dipulihkan dari file JSON "${file.name}".`,
          'pengaturan'
        );

        onRestoreData(parsed, notif);
        setMsgSuccess(`Database berhasil dipulihkan dari file JSON "${file.name}".`);
        setMsgError('');
      } catch (err: any) {
        setMsgError(err.message || 'Gagal memproses file backup JSON.');
        setMsgSuccess('');
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  // -------------------------------------------------------------
  // 4. RESET DATABASE SAMPEL
  // -------------------------------------------------------------
  const handleConfirmReset = () => {
    const notif = createNotification(
      'Reset Database Dilakukan',
      'Database aplikasi telah dikembalikan ke kondisi data awal sampel.',
      'pengaturan'
    );
    onResetData(notif);
    setShowResetModal(false);
    setMsgSuccess('Database telah berhasil direset ke data sampel awal.');
    setMsgError('');
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <DatabaseBackup size={22} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Backup & Restore Database</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                  SQL & JSON
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Amankan seluruh data sekolah, master guru, siswa, kelas, mapel, dan nilai dalam format skrip SQL atau file JSON.
              </p>
            </div>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 text-[11px]">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 shrink-0">
            <Users size={12} className="text-blue-600" />
            <span>{totalSiswa} Siswa</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 shrink-0">
            <GraduationCap size={12} className="text-emerald-600" />
            <span>{totalGuru} Guru</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold flex items-center gap-1 shrink-0">
            <FileSpreadsheet size={12} className="text-purple-600" />
            <span>{totalNilaiSumatif + totalNilaiK9} Nilai</span>
          </span>
        </div>
      </div>

      {/* Alerts */}
      {msgSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{msgSuccess}</span>
          </div>
          <button
            onClick={() => setMsgSuccess('')}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {msgError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={18} className="text-rose-600 shrink-0" />
            <span>{msgError}</span>
          </div>
          <button
            onClick={() => setMsgError('')}
            className="text-rose-700 hover:text-rose-900 p-1 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Format Selector Tabs */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('sql')}
          className={`flex items-center space-x-2 py-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'sql'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCode2 size={16} />
          <span>File SQL (.sql)</span>
          <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full">
            Direkomendasikan
          </span>
        </button>

        <button
          onClick={() => setActiveTab('json')}
          className={`flex items-center space-x-2 py-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'json'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileJson size={16} />
          <span>File JSON (.json)</span>
        </button>

        <button
          onClick={() => setActiveTab('reset')}
          className={`flex items-center space-x-2 py-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'reset'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-rose-600'
          }`}
        >
          <RotateCcw size={16} />
          <span>Reset Database</span>
        </button>
      </div>

      {/* TAB 1: SQL (.sql) */}
      {activeTab === 'sql' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Ekspor File SQL */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Download size={24} />
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                    Ekspor Database (.sql)
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    1. Unduh Backup File SQL
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    Buat file dump SQL standar yang memuat seluruh definisi tabel (`CREATE TABLE`) dan baris data (`INSERT INTO`) untuk seluruh data penilaian siswa.
                  </p>
                </div>

                {/* Database tables overview inside card */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Table2 size={13} className="text-blue-500" />
                    <span>Daftar Tabel Database:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-600 text-[11px]">
                    <div>• <code>pengaturan_sekolah</code></div>
                    <div>• <code>tahun_ajaran</code></div>
                    <div>• <code>guru</code> ({totalGuru} data)</div>
                    <div>• <code>kelas</code> ({totalKelas} data)</div>
                    <div>• <code>mapel</code> ({totalMapel} data)</div>
                    <div>• <code>siswa</code> ({totalSiswa} data)</div>
                    <div>• <code>nilai_sumatif</code> ({totalNilaiSumatif})</div>
                    <div>• <code>nilai_kelas9</code> ({totalNilaiK9})</div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/60 flex items-start gap-2">
                  <span className="text-amber-600 font-bold">ℹ</span>
                  <span>
                    File SQL ini dapat dibuka di editor teks, diimpor ke MySQL/MariaDB/phpMyAdmin, atau dipulihkan kembali ke aplikasi kapan saja secara 100% presisi.
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleExportSqlBackup}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Download size={16} />
                  <span>Unduh File Backup SQL (.sql)</span>
                </button>

                <button
                  onClick={handleOpenSqlPreview}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Eye size={15} />
                  <span>Lihat / Salin Script SQL</span>
                </button>
              </div>
            </div>

            {/* Card 2: Impor & Restore File SQL */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Upload size={24} />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    Restorasi Database (.sql)
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    2. Pulihkan (Restore) dari File SQL
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    Unggah file cadangan `.sql` yang telah diunduh sebelumnya. Sistem akan menganalisis isi query SQL dan menampilkan pratinjau data sebelum dipulihkan.
                  </p>
                </div>

                {/* Dropzone area */}
                <div
                  onClick={() => sqlFileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-2xl p-6 text-center transition-all cursor-pointer space-y-2"
                >
                  <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <FileCode2 size={24} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-800">
                      Klik untuk memilih file SQL
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Mendukung format file <code>.sql</code>
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <p className="font-semibold text-slate-700 mb-0.5">Pemeriksaan Keamanan:</p>
                  <p>
                    Sebelum proses pemulihan dieksekusi, sistem akan memvalidasi struktur tabel dan menampilkan ringkasan jumlah data untuk konfirmasi Anda.
                  </p>
                </div>
              </div>

              <div>
                <input
                  type="file"
                  ref={sqlFileInputRef}
                  onChange={handleSelectSqlFile}
                  accept=".sql,text/plain"
                  className="hidden"
                />
                <button
                  onClick={() => sqlFileInputRef.current?.click()}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Upload size={16} />
                  <span>Pilih & Pulihkan File SQL</span>
                </button>
              </div>
            </div>
          </div>

          {/* Database Schema Reference Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <Database size={16} className="text-cyan-400" />
                <span>Skema Database Relasional SIPENIS</span>
              </h4>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Tabel utama saling terhubung menggunakan Primary Key (`id`, `nip`, `nisn`) sehingga kompatibel dengan RDBMS (MySQL, PostgreSQL, MariaDB, SQLite).
              </p>
            </div>
            <button
              onClick={handleOpenSqlPreview}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
            >
              <Eye size={14} />
              <span>Buka Skema & Query SQL</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: JSON (.json) */}
      {activeTab === 'json' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card: Export JSON */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Download size={24} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">1. Unduh Backup JSON</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Simpan cadangan data lengkap seluruh sekolah, siswa, guru, dan nilai ke komputer lokal dalam format file data `.json`.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-700">Karakteristik Format JSON:</p>
                <p>• Ringan dan mudah dibaca oleh developer.</p>
                <p>• Berisi snapshot lengkap state lokal aplikasi.</p>
              </div>
            </div>

            <button
              onClick={handleExportJsonBackup}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Download size={16} />
              <span>Unduh Backup JSON (.json)</span>
            </button>
          </div>

          {/* Card: Import JSON */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Upload size={24} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">2. Restore dari File JSON</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Unggah file `.json` cadangan yang telah diunduh sebelumnya untuk mengembalikan seluruh state data aplikasi ke kondisi saat pencadangan.
              </p>
              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-700">Validasi File:</p>
                <p>• Memvalidasi node sekolah, siswaList, dan guruList.</p>
                <p>• Menolak file yang rusak atau format tidak cocok.</p>
              </div>
            </div>

            <input
              type="file"
              ref={jsonFileInputRef}
              onChange={handleImportJsonFile}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => jsonFileInputRef.current?.click()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Upload size={16} />
              <span>Pilih File Backup JSON</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: RESET DATABASE */}
      {activeTab === 'reset' && (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs max-w-2xl mx-auto space-y-5">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
              <RotateCcw size={28} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Reset Database ke Setelan Awal</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mengembalikan seluruh data ke data sampel bawaan SMP Negeri 2 Kemranjen.
              </p>
            </div>
          </div>

          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-800">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle size={15} />
              <span>Peringatan Penting:</span>
            </p>
            <p>
              Tindakan ini akan menghapus nilai-nilai baru, perubahan siswa/guru, dan pengaturan khusus yang telah Anda input, lalu mengembalikannya ke data demo default.
            </p>
            <p className="font-semibold">
              Disarankan untuk mengunduh Backup File SQL atau JSON terlebih dahulu sebelum melakukan reset.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={handleExportSqlBackup}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              Cadangkan SQL Dulu
            </button>
            <button
              onClick={() => setShowResetModal(true)}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-500/20 transition-all flex items-center space-x-2 cursor-pointer"
            >
              <RotateCcw size={16} />
              <span>Reset Database Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 1: SQL VIEWER / PREVIEW                           */}
      {/* ======================================================= */}
      {showSqlViewerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FileCode2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Pratinjau Skrip SQL Database
                  </h3>
                  <p className="text-xs text-slate-500">
                    Format: MySQL / MariaDB / SQLite compatible DDL & DML
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlViewerModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Toolbar */}
            <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-600 font-medium">
                <span>Ukuran Skrip:</span>
                <span className="font-bold text-slate-800">
                  {Math.round(generatedSqlPreview.length / 1024)} KB
                </span>
                <span>•</span>
                <span>Baris:</span>
                <span className="font-bold text-slate-800">
                  {generatedSqlPreview.split('\n').length} baris
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopySqlToClipboard}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-lg shadow-2xs flex items-center space-x-1.5 cursor-pointer transition-all"
                >
                  {copiedSql ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-600">Tersalin ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Salin Semua SQL</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleExportSqlBackup}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer transition-all"
                >
                  <Download size={14} />
                  <span>Unduh File (.sql)</span>
                </button>
              </div>
            </div>

            {/* SQL Code Area */}
            <div className="p-4 flex-1 overflow-auto bg-slate-950 font-mono text-[11px] text-slate-200 leading-relaxed selection:bg-blue-600 selection:text-white">
              <pre className="whitespace-pre">{generatedSqlPreview}</pre>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setShowSqlViewerModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 2: KONFIRMASI RESTORE FILE SQL                    */}
      {/* ======================================================= */}
      {pendingSqlRestore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-emerald-600">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Konfirmasi Pemulihan Database SQL
                </h3>
                <p className="text-xs text-slate-500">
                  File SQL telah diverifikasi dan siap dipulihkan ke aplikasi.
                </p>
              </div>
            </div>

            {/* File info box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama File:</span>
                <span className="font-bold text-slate-800 break-all">{pendingSqlRestore.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ukuran File:</span>
                <span className="font-semibold text-slate-700">{pendingSqlRestore.fileSizeKb} KB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sekolah:</span>
                <span className="font-semibold text-blue-700">
                  {pendingSqlRestore.parseResult.stats?.sekolahName || 'SMPN 2 Kemranjen'}
                </span>
              </div>
            </div>

            {/* Data breakdown */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Ringkasan Data yang Akan Dipulihkan:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center space-x-2">
                  <Users size={16} className="text-blue-600" />
                  <div>
                    <span className="block text-slate-500 text-[10px]">Data Siswa</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pendingSqlRestore.parseResult.stats?.siswaCount || 0}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center space-x-2">
                  <GraduationCap size={16} className="text-emerald-600" />
                  <div>
                    <span className="block text-slate-500 text-[10px]">Data Guru</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pendingSqlRestore.parseResult.stats?.guruCount || 0}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center space-x-2">
                  <School size={16} className="text-purple-600" />
                  <div>
                    <span className="block text-slate-500 text-[10px]">Data Kelas</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pendingSqlRestore.parseResult.stats?.kelasCount || 0}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center space-x-2">
                  <BookOpen size={16} className="text-amber-600" />
                  <div>
                    <span className="block text-slate-500 text-[10px]">Mata Pelajaran</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pendingSqlRestore.parseResult.stats?.mapelCount || 0}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-50/60 border border-cyan-100 flex items-center space-x-2">
                  <FileSpreadsheet size={16} className="text-cyan-600" />
                  <div>
                    <span className="block text-slate-500 text-[10px]">Nilai Sumatif</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pendingSqlRestore.parseResult.stats?.nilaiSumatifCount || 0}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-center space-x-2">
                  <Award size={16} className="text-indigo-600" />
                  <div>
                    <span className="block text-slate-500 text-[10px]">Nilai Kelas 9</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {pendingSqlRestore.parseResult.stats?.nilaiKelas9Count || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] leading-relaxed">
              <strong>Peringatan:</strong> Seluruh data yang sedang aktif pada sesi ini akan digantikan dengan data yang ada di dalam file SQL ini.
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setPendingSqlRestore(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Batalkan
              </button>
              <button
                onClick={handleConfirmSqlRestore}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 cursor-pointer flex items-center space-x-1.5"
              >
                <CheckCircle2 size={16} />
                <span>Ya, Pulihkan Database Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 3: KONFIRMASI RESET DATABASE                      */}
      {/* ======================================================= */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Konfirmasi Reset Database
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mengembalikan database aplikasi ke setelan data awal sampel? Seluruh data guru, siswa, dan entri nilai yang Anda buat secara manual akan digantikan.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Ya, Reset Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
