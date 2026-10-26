import React, { useState, useEffect, useRef } from 'react';
import { AppState, AuthUser, NilaiKelas9, K9MapelDetail, NotificationLog } from '../../types';
import { createNotification } from '../../lib/storage';
import { calculateK9MapelScores, formatScoreVal, isGrade9Student } from '../../lib/k9GradeHelper';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  Save,
  CheckCircle,
  GraduationCap,
  Settings,
  Calculator,
  Info,
  HelpCircle,
  Check,
  FileSpreadsheet,
  FileDown,
  Download,
  Upload,
  Edit3,
  RotateCcw,
  X,
  AlertCircle,
  AlertTriangle,
  CheckSquare,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Filter,
  Users,
  BookOpen,
} from 'lucide-react';

interface InputNilaiKelas9Props {
  appState: AppState;
  authUser?: AuthUser | null;
  onUpdateNilaiKelas9: (newList: NilaiKelas9[], notif: NotificationLog) => void;
}

export const InputNilaiKelas9: React.FC<InputNilaiKelas9Props> = ({
  appState,
  authUser,
  onUpdateNilaiKelas9,
}) => {
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

  // Filter Kelas 9
  const kelas9List = appState.kelasList.filter(
    (k) =>
      Number(k.tingkat) === 9 ||
      k.kodeKelas.startsWith('9') ||
      k.kodeKelas.startsWith('IX') ||
      k.namaKelas.includes('9') ||
      k.namaKelas.includes('IX')
  );
  const [selectedKelasId, setSelectedKelasId] = useState<string>(
    waliKelas9Obj?.id || kelas9List[0]?.id || appState.kelasList[0]?.id || ''
  );

  useEffect(() => {
    if (waliKelas9Obj && (!selectedKelasId || !kelas9List.some((k) => k.id === selectedKelasId))) {
      setSelectedKelasId(waliKelas9Obj.id);
    }
  }, [waliKelas9Obj]);

  if (isGuru && !isWaliKelas9) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto shadow-md">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Akses Terbatas: Kelulusan K9</h2>
        <p className="text-sm text-slate-600">
          Menu <strong>Analisis Kelas 9 (Kelulusan K9)</strong> hanya dapat diakses oleh <strong>Administrator</strong> dan <strong>Wali Kelas 9</strong>.
        </p>
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
          Untuk mengentri nilai sumatif siswa pada mata pelajaran yang Anda ampu, silakan gunakan menu <strong>Nilai Sumatif &gt; Input Nilai</strong>.
        </div>
      </div>
    );
  }

  // Filter Mapel
  const [selectedMapelId, setSelectedMapelId] = useState<string>(
    appState.mapelList[0]?.id || ''
  );

  // Pengaturan Bobot Ujian Sekolah (US)
  const [bobotUsTulis, setBobotUsTulis] = useState<number>(60);
  const [bobotUsPraktik, setBobotUsPraktik] = useState<number>(40);

  // Pengaturan Bobot Nilai Akhir
  const [bobotRataRapor, setBobotRataRapor] = useState<number>(60);
  const [bobotRataUs, setBobotRataUs] = useState<number>(40);

  // Active TA
  const activeTA =
    appState.tahunAjaranList.find((t) => t.id === appState.activeTahunAjaranId) ||
    appState.tahunAjaranList[0];

  const selectedMapelObj = appState.mapelList.find((m) => m.id === selectedMapelId);
  const selectedKelasObj = appState.kelasList.find((k) => k.id === selectedKelasId);

  // Students in selected K9 class (Strictly match selected class ID or class code)
  const studentsInClass = appState.siswaList.filter(
    (s) => s.kelasId === selectedKelasId || (selectedKelasObj && s.kodeKelas === selectedKelasObj.kodeKelas)
  );

  // Filter Agama & Statistik Komposisi Agama di Rombel
  const [selectedAgamaFilter, setSelectedAgamaFilter] = useState<string>('ALL');

  const agamaStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    studentsInClass.forEach((s) => {
      const ag = (s.agama || 'Islam').trim();
      counts[ag] = (counts[ag] || 0) + 1;
    });
    return counts;
  }, [studentsInClass]);

  const distinctAgamas = Object.keys(agamaStats);
  const hasMultipleAgama = distinctAgamas.length > 1;

  // Deteksi Otomatis Jika Mata Pelajaran Merupakan Mapel Pendidikan Agama
  const isMapelAgama = Boolean(
    selectedMapelObj &&
      (selectedMapelObj.namaMapel.toLowerCase().includes('agama') ||
        selectedMapelObj.namaMapel.toLowerCase().includes('budi pekerti') ||
        selectedMapelObj.kodeMapel.toLowerCase() === 'pai' ||
        selectedMapelObj.kodeMapel.toLowerCase() === 'pak' ||
        selectedMapelObj.namaMapel.toLowerCase().includes('katolik') ||
        selectedMapelObj.namaMapel.toLowerCase().includes('kristen') ||
        selectedMapelObj.namaMapel.toLowerCase().includes('hindu') ||
        selectedMapelObj.namaMapel.toLowerCase().includes('buddha') ||
        selectedMapelObj.namaMapel.toLowerCase().includes('konghucu'))
  );

  // Daftar Siswa yang Ditampilkan Sesuai Filter Agama Aktif
  const displayedStudents = React.useMemo(() => {
    if (selectedAgamaFilter === 'ALL') return studentsInClass;
    return studentsInClass.filter(
      (s) => (s.agama || 'Islam').trim().toLowerCase() === selectedAgamaFilter.toLowerCase()
    );
  }, [studentsInClass, selectedAgamaFilter]);

  const getAgamaBadgeStyle = (agama?: string) => {
    const ag = (agama || 'Islam').trim().toLowerCase();
    if (ag.includes('islam')) return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    if (ag.includes('kristen') || ag.includes('protestan')) return { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', className: 'bg-blue-50 text-blue-800 border-blue-200' };
    if (ag.includes('katolik')) return { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', className: 'bg-purple-50 text-purple-800 border-purple-200' };
    if (ag.includes('hindu')) return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    if (ag.includes('buddha') || ag.includes('budha')) return { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', className: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
    if (ag.includes('konghucu')) return { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', className: 'bg-rose-50 text-rose-800 border-rose-200' };
    return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  // Grid Data for 6 Semesters + US Tulis + US Praktik per student for selected mapel
  // Key: studentId
  const [gridData, setGridData] = useState<Record<string, K9MapelDetail>>({});
  const [savedStatusMap, setSavedStatusMap] = useState<Record<string, boolean>>({});
  const [globalSavedSuccess, setGlobalSavedSuccess] = useState(false);
  const [massResetSuccessNotice, setMassResetSuccessNotice] = useState(false);

  // State for Edit Manual Modal
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editFormDetail, setEditFormDetail] = useState<K9MapelDetail | null>(null);

  // State for Import Excel Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<
    Array<{
      siswaId: string;
      nama: string;
      nisn: string;
      agama?: string;
      jenisKelamin?: string;
      detail: K9MapelDetail;
    }>
  >([]);
  const [importError, setImportError] = useState<string | null>(null);

  // State for Reset Confirm Modals
  const [resetConfirmStudentId, setResetConfirmStudentId] = useState<string | null>(null);
  const [showMassResetModal, setShowMassResetModal] = useState<boolean>(false);

  // Initialize grid data when selectedMapelId or selectedKelasId changes
  useEffect(() => {
    if (!selectedMapelId) return;

    const initialGrid: Record<string, K9MapelDetail> = {};

    studentsInClass.forEach((s) => {
      const existingRecord = appState.nilaiKelas9List.find((n) => n.siswaId === s.id);
      const detail = existingRecord?.k9DetailMapel?.[selectedMapelId];

      if (detail) {
        initialGrid[s.id] = { ...detail };
      } else {
        // Cek jika terdapat nilai legacy, jika tidak ada maka inisialisasi dengan 0
        const legacyRapor = existingRecord?.nilaiRaporSem1_5?.[selectedMapelId] ?? 0;
        const legacyUS = existingRecord?.nilaiSumatifAkhir?.[selectedMapelId] ?? 0;

        initialGrid[s.id] = {
          s1: legacyRapor,
          s2: legacyRapor,
          s3: legacyRapor,
          s4: legacyRapor,
          s5: legacyRapor,
          s6: legacyRapor,
          usTulis: legacyUS,
          usPraktik: legacyUS,
        };
      }
    });

    setGridData(initialGrid);
    setSavedStatusMap({});
    setGlobalSavedSuccess(false);
    setMassResetSuccessNotice(false);
  }, [selectedKelasId, selectedMapelId, appState.nilaiKelas9List]);

  // Input Change Handler
  const handleScoreChange = (
    studentId: string,
    field: keyof K9MapelDetail,
    val: string
  ) => {
    const num = Math.min(100, Math.max(0, parseInt(val) || 0));
    setGridData((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          s1: 0,
          s2: 0,
          s3: 0,
          s4: 0,
          s5: 0,
          s6: 0,
          usTulis: 0,
          usPraktik: 0,
        }),
        [field]: num,
      },
    }));
    setSavedStatusMap((prev) => ({ ...prev, [studentId]: false }));
    setGlobalSavedSuccess(false);
    setMassResetSuccessNotice(false);
  };

  // Helper Calculations: 2 Desimal di belakang koma (.toFixed(2))
  const calculateRerataRapor = (detail: K9MapelDetail): string => {
    if (!detail) return '0.00';
    const sum =
      (Number(detail.s1) || 0) +
      (Number(detail.s2) || 0) +
      (Number(detail.s3) || 0) +
      (Number(detail.s4) || 0) +
      (Number(detail.s5) || 0) +
      (Number(detail.s6) || 0);
    return (sum / 6).toFixed(2);
  };

  const calculateRerataUS = (detail: K9MapelDetail): string => {
    if (!detail) return '0.00';
    const totalBobot = (bobotUsTulis || 0) + (bobotUsPraktik || 0) || 1;
    const weighted =
      (Number(detail.usTulis) || 0) * (bobotUsTulis || 0) +
      (Number(detail.usPraktik) || 0) * (bobotUsPraktik || 0);
    return (weighted / totalBobot).toFixed(2);
  };

  const calculateNilaiAkhir = (detail: K9MapelDetail): string => {
    if (!detail) return '0.00';
    const rerataRaporNum = parseFloat(calculateRerataRapor(detail));
    const rerataUSNum = parseFloat(calculateRerataUS(detail));

    const totalBobotNA = (bobotRataRapor || 0) + (bobotRataUs || 0) || 1;
    const weightedNA =
      rerataRaporNum * (bobotRataRapor || 0) + rerataUSNum * (bobotRataUs || 0);
    return (weightedNA / totalBobotNA).toFixed(2);
  };

  // Open Edit Manual Modal
  const handleOpenEditManual = (studentId: string) => {
    const detail = gridData[studentId] || {
      s1: 0,
      s2: 0,
      s3: 0,
      s4: 0,
      s5: 0,
      s6: 0,
      usTulis: 0,
      usPraktik: 0,
    };
    setEditingStudentId(studentId);
    setEditFormDetail({ ...detail });
  };

  // Save Edit Manual Modal
  const handleSaveEditManual = () => {
    if (!editingStudentId || !editFormDetail) return;
    setGridData((prev) => ({
      ...prev,
      [editingStudentId]: { ...editFormDetail },
    }));
    setSavedStatusMap((prev) => ({ ...prev, [editingStudentId]: false }));
    setEditingStudentId(null);
    setEditFormDetail(null);
    setMassResetSuccessNotice(false);
  };

  // Reset Single Student Nilai to 0
  const handleConfirmResetStudent = (studentId: string) => {
    const resetDetail: K9MapelDetail = {
      s1: 0,
      s2: 0,
      s3: 0,
      s4: 0,
      s5: 0,
      s6: 0,
      usTulis: 0,
      usPraktik: 0,
    };
    setGridData((prev) => ({
      ...prev,
      [studentId]: resetDetail,
    }));
    setSavedStatusMap((prev) => ({ ...prev, [studentId]: false }));
    setResetConfirmStudentId(null);
    setGlobalSavedSuccess(false);
  };

  // Reset Massal: Reset nilai siswa yang sedang ditampilkan / disaring menjadi 0
  const handleConfirmMassReset = () => {
    const resetDetail: K9MapelDetail = {
      s1: 0,
      s2: 0,
      s3: 0,
      s4: 0,
      s5: 0,
      s6: 0,
      usTulis: 0,
      usPraktik: 0,
    };

    setGridData((prev) => {
      const nextGrid = { ...prev };
      displayedStudents.forEach((s) => {
        nextGrid[s.id] = { ...resetDetail };
      });
      return nextGrid;
    });

    setSavedStatusMap({});
    setShowMassResetModal(false);
    setGlobalSavedSuccess(false);
    setMassResetSuccessNotice(true);
  };

  // Save Single Student Data
  const handleSaveStudent = (studentId: string) => {
    const student = appState.siswaList.find((s) => s.id === studentId);
    if (!student || !selectedMapelId) return;

    const detail = gridData[studentId];
    if (!detail) return;

    const rerataRapor = parseFloat(calculateRerataRapor(detail));
    const rerataUS = parseFloat(calculateRerataUS(detail));
    const nilaiAkhir = parseFloat(calculateNilaiAkhir(detail));

    const existingRecord = appState.nilaiKelas9List.find((n) => n.siswaId === studentId);

    const updatedDetailMapel = {
      ...(existingRecord?.k9DetailMapel || {}),
      [selectedMapelId]: detail,
    };

    const updatedRaporSem1_5 = {
      ...(existingRecord?.nilaiRaporSem1_5 || {}),
      [selectedMapelId]: rerataRapor,
    };

    const updatedSumatifAkhir = {
      ...(existingRecord?.nilaiSumatifAkhir || {}),
      [selectedMapelId]: rerataUS,
    };

    const updatedNilaiSekolah = {
      ...(existingRecord?.nilaiSekolah || {}),
      [selectedMapelId]: nilaiAkhir,
    };

    const mapelValues: number[] = Object.values(updatedNilaiSekolah);
    const overallAvg =
      mapelValues.length > 0
        ? parseFloat(
            (mapelValues.reduce((a: number, b: number) => a + b, 0) / mapelValues.length).toFixed(2)
          )
        : nilaiAkhir;

    const studentIdx = studentsInClass.findIndex((s) => s.id === studentId) + 1;
    const padIdx = String(studentIdx).padStart(3, '0');

    const newRecord: NilaiKelas9 = {
      id: existingRecord ? existingRecord.id : 'nk9-' + studentId,
      siswaId: studentId,
      tahunAjaran: activeTA.tahun,
      nilaiRaporSem1_5: updatedRaporSem1_5,
      nilaiSumatifAkhir: updatedSumatifAkhir,
      nilaiSekolah: updatedNilaiSekolah,
      k9DetailMapel: updatedDetailMapel,
      rataRataKeseluruhan: overallAvg,
      statusLulus: existingRecord?.statusLulus || 'LULUS',
      noSuratSKL: existingRecord?.noSuratSKL || `421.3/SKL-${padIdx}/SMPN2/VI/2026`,
      noSuratSKNR: existingRecord?.noSuratSKNR || `421.3/SKNR-${padIdx}/SMPN2/VI/2026`,
      updatedAt: new Date().toLocaleString('id-ID'),
    };

    const updatedList = appState.nilaiKelas9List.filter((n) => n.siswaId !== studentId);
    updatedList.push(newRecord);

    const mapelObj = appState.mapelList.find((m) => m.id === selectedMapelId);

    const notif = createNotification(
      'Input Nilai Kelas 9',
      `Data nilai K9 ${mapelObj?.namaMapel || ''} siswa ${student.nama} berhasil disimpan (NA: ${nilaiAkhir.toFixed(2)}).`,
      'kelas9'
    );

    onUpdateNilaiKelas9(updatedList, notif);
    setSavedStatusMap((prev) => ({ ...prev, [studentId]: true }));
    setMassResetSuccessNotice(false);
  };

  // Save Batch Students in Class (Disaring atau Seluruhnya)
  const handleSaveAll = () => {
    let updatedList = [...appState.nilaiKelas9List];
    const targetStudents = displayedStudents;

    targetStudents.forEach((student) => {
      const detail = gridData[student.id];
      if (!detail) return;

      const rerataRapor = parseFloat(calculateRerataRapor(detail));
      const rerataUS = parseFloat(calculateRerataUS(detail));
      const nilaiAkhir = parseFloat(calculateNilaiAkhir(detail));

      const existingRecord = updatedList.find((n) => n.siswaId === student.id);

      const updatedDetailMapel = {
        ...(existingRecord?.k9DetailMapel || {}),
        [selectedMapelId]: detail,
      };

      const updatedRaporSem1_5 = {
        ...(existingRecord?.nilaiRaporSem1_5 || {}),
        [selectedMapelId]: rerataRapor,
      };

      const updatedSumatifAkhir = {
        ...(existingRecord?.nilaiSumatifAkhir || {}),
        [selectedMapelId]: rerataUS,
      };

      const updatedNilaiSekolah = {
        ...(existingRecord?.nilaiSekolah || {}),
        [selectedMapelId]: nilaiAkhir,
      };

      const mapelValues: number[] = Object.values(updatedNilaiSekolah);
      const overallAvg =
        mapelValues.length > 0
          ? parseFloat(
              (mapelValues.reduce((a: number, b: number) => a + b, 0) / mapelValues.length).toFixed(2)
            )
          : nilaiAkhir;

      const studentIdx = studentsInClass.findIndex((s) => s.id === student.id) + 1;
      const padIdx = String(studentIdx).padStart(3, '0');

      const newRecord: NilaiKelas9 = {
        id: existingRecord ? existingRecord.id : 'nk9-' + student.id,
        siswaId: student.id,
        tahunAjaran: activeTA.tahun,
        nilaiRaporSem1_5: updatedRaporSem1_5,
        nilaiSumatifAkhir: updatedSumatifAkhir,
        nilaiSekolah: updatedNilaiSekolah,
        k9DetailMapel: updatedDetailMapel,
        rataRataKeseluruhan: overallAvg,
        statusLulus: existingRecord?.statusLulus || 'LULUS',
        noSuratSKL: existingRecord?.noSuratSKL || `421.3/SKL-${padIdx}/SMPN2/VI/2026`,
        noSuratSKNR: existingRecord?.noSuratSKNR || `421.3/SKNR-${padIdx}/SMPN2/VI/2026`,
        updatedAt: new Date().toLocaleString('id-ID'),
      };

      updatedList = updatedList.filter((n) => n.siswaId !== student.id);
      updatedList.push(newRecord);
    });

    const mapelObj = appState.mapelList.find((m) => m.id === selectedMapelId);
    const filterText = selectedAgamaFilter === 'ALL' ? '' : ` (Khusus Agama ${selectedAgamaFilter})`;

    const notif = createNotification(
      'Input Nilai Kelas 9 (Batch)',
      `Data nilai K9 ${mapelObj?.namaMapel || ''}${filterText} untuk ${targetStudents.length} siswa berhasil diperbarui.`,
      'kelas9'
    );

    onUpdateNilaiKelas9(updatedList, notif);

    const newStatusMap: Record<string, boolean> = { ...savedStatusMap };
    targetStudents.forEach((s) => (newStatusMap[s.id] = true));
    setSavedStatusMap(newStatusMap);
    setGlobalSavedSuccess(true);
    setMassResetSuccessNotice(false);
  };

  // Helper to save ExcelJS Workbook in browser
  const saveWorkbookK9 = async (workbook: ExcelJS.Workbook, fileName: string) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  // Export Data to Excel (Colored, Proportional, Dilengkapi Agama, Rerata Rapor, Rerata US & Nilai Akhir)
  const handleExportExcel = async () => {
    const selectedMapelObj = appState.mapelList.find((m) => m.id === selectedMapelId);
    const selectedKelasObj = appState.kelasList.find((k) => k.id === selectedKelasId);
    const activeTA = appState.tahunAjaranList.find((t) => t.id === appState.activeTahunAjaranId) || appState.tahunAjaranList[0];

    const targetStudents =
      selectedAgamaFilter === 'ALL'
        ? studentsInClass
        : studentsInClass.filter(
            (s) => (s.agama || 'Islam').trim().toLowerCase() === selectedAgamaFilter.toLowerCase()
          );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil Assessment System';
    wb.lastModifiedBy = 'e-Dafnil Assessment System K9';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet(`Nilai K9 - ${selectedMapelObj?.kodeMapel || 'Mapel'}`, {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF1B4F72' } },
    });

    const totalCols = 17; // No, NISN, NIS, Nama, L/P, Agama, S1, S2, S3, S4, S5, S6, Rerata Rapor, US Tulis, US Praktik, Rerata US, Nilai Akhir

    // --- ROW 1: HEADER DINAS ---
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${appState.sekolah.kabupatenKota?.toUpperCase() || 'BANYUMAS'} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    // --- ROW 2: NAMA SEKOLAH ---
    const row2 = ws.addRow([`${appState.sekolah.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN'} - SISTEM e-DAFNIL KELAS 9`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    // --- ROW 3: JUDUL DOKUMEN ---
    const row3 = ws.addRow(['REKAPITULASI HASIL NILAI KELAS 9 (RAPOR SEMESTER 1-6, UJIAN SEKOLAH & NILAI AKHIR)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    // --- ROW 4: EMPTY SEPARATOR ---
    const row4 = ws.addRow([]);
    row4.height = 8;

    // --- ROW 5: METADATA ROW 1 (MATA PELAJARAN, KELAS, BOBOT US) ---
    const row5 = ws.addRow([]);
    row5.height = 24;

    ws.mergeCells(5, 1, 5, 6);
    const cellMapel = ws.getCell(5, 1);
    cellMapel.value = `Mata Pelajaran: ${selectedMapelObj?.namaMapel || 'Semua Mata Pelajaran'} (${selectedMapelObj?.kodeMapel || '-'})`;
    cellMapel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    cellMapel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells(5, 7, 5, 12);
    const cellKelas = ws.getCell(5, 7);
    cellKelas.value = `Kelas: ${selectedKelasObj?.namaKelas || '-'} (Wali Kelas: ${selectedKelasObj?.waliKelasNama || '-'})`;
    cellKelas.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cellKelas.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells(5, 13, 5, totalCols);
    const cellBobotUS = ws.getCell(5, 13);
    cellBobotUS.value = `Bobot US: Tulis ${bobotUsTulis}% : Praktik ${bobotUsPraktik}%`;
    cellBobotUS.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF1E8449' } };
    cellBobotUS.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(5, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 7 || c === 13 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 6 || c === 12 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    // --- ROW 6: METADATA ROW 2 (TAHUN AJARAN, JUMLAH SISWA / FILTER AGAMA, BOBOT NA) ---
    const row6 = ws.addRow([]);
    row6.height = 24;

    ws.mergeCells(6, 1, 6, 6);
    const cellTA = ws.getCell(6, 1);
    cellTA.value = `Tahun Ajaran: ${activeTA.tahun}  |  Semester: ${activeTA.semester}`;
    cellTA.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    cellTA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells(6, 7, 6, 12);
    const cellJml = ws.getCell(6, 7);
    const filterDesc = selectedAgamaFilter === 'ALL' ? 'Semua Agama' : `Khusus Agama ${selectedAgamaFilter}`;
    cellJml.value = `Target: ${targetStudents.length} Siswa (${filterDesc})`;
    cellJml.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
    cellJml.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells(6, 13, 6, totalCols);
    const cellBobotNA = ws.getCell(6, 13);
    cellBobotNA.value = `Bobot NA: Rapor ${bobotRataRapor}% : US ${bobotRataUs}%`;
    cellBobotNA.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
    cellBobotNA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(6, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 7 || c === 13 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 6 || c === 12 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    // --- ROW 7: EMPTY SEPARATOR ---
    const row7 = ws.addRow([]);
    row7.height = 8;

    // --- ROW 8: TABLE HEADERS (NO, NISN, NIS, NAMA, L/P, AGAMA, S1..S6, RERATA RAPOR, US TULIS, US PRAKTIK, RERATA US, NILAI AKHIR) ---
    const headerLabels = [
      'No',
      'NISN',
      'NIS',
      'Nama Siswa',
      'L/P',
      'Agama',
      'S1',
      'S2',
      'S3',
      'S4',
      'S5',
      'S6',
      'Rerata Rapor',
      'US Tulis',
      'US Praktik',
      'Rerata US',
      'Nilai Akhir',
    ];

    const headerRow = ws.addRow(headerLabels);
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    headerRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F3D64' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      if (colNumber <= 6) {
        // Identity: Dark Navy
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 12) {
        // S1..S6: Royal Blue
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 13) {
        // Rerata Rapor: Deep Cyan / Teal
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E7490' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 14) {
        // US Tulis: Emerald Green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 15) {
        // US Praktik: Amber Tangerine
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 16) {
        // Rerata US: Forest Green
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        // Nilai Akhir: Rust Deep Orange / Crimson Amber
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // --- DATA ROWS ---
    const startDataRow = 9;
    const totalBobotUS = (bobotUsTulis || 0) + (bobotUsPraktik || 0) || 1;
    const totalBobotNA = (bobotRataRapor || 0) + (bobotRataUs || 0) || 1;

    targetStudents.forEach((s, idx) => {
      const detail = gridData[s.id] || {
        s1: 0,
        s2: 0,
        s3: 0,
        s4: 0,
        s5: 0,
        s6: 0,
        usTulis: 0,
        usPraktik: 0,
      };

      const calc = calculateK9MapelScores(
        detail,
        bobotUsTulis,
        bobotUsPraktik,
        bobotRataRapor,
        bobotRataUs
      );

      const r = startDataRow + idx;

      const rowValues: any[] = [
        idx + 1,
        s.nisn || '',
        s.nis || '',
        s.nama || '',
        s.jenisKelamin || 'L',
        s.agama || 'Islam',
        detail.s1,
        detail.s2,
        detail.s3,
        detail.s4,
        detail.s5,
        detail.s6,
        { formula: `ROUND(AVERAGE(G${r}:L${r}),2)`, result: calc.rerataRapor },
        detail.usTulis,
        detail.usPraktik,
        { formula: `ROUND((N${r}*${bobotUsTulis}+O${r}*${bobotUsPraktik})/${totalBobotUS},2)`, result: calc.rerataUS },
        { formula: `ROUND((M${r}*${bobotRataRapor}+P${r}*${bobotRataUs})/${totalBobotNA},2)`, result: calc.nilaiSekolah },
      ];

      const dataRow = ws.addRow(rowValues);
      dataRow.height = 23;

      const isEven = idx % 2 === 1;
      const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 2 || colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 6) {
          // Agama column
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0369A1' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0F9FF' : 'FFFFFFFF' } };
        } else if (colNumber <= 12) {
          // S1..S6
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFEFF6FF' : 'FFF8FAFC' } };
          cell.numFmt = '0.00';
        } else if (colNumber === 13) {
          // Rerata Rapor
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0E7490' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFE0F2FE' : 'FFF0F9FF' } };
          cell.numFmt = '0.00';
        } else if (colNumber === 14) {
          // US Tulis
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0FDF4' : 'FFFFFFFF' } };
          cell.numFmt = '0.00';
        } else if (colNumber === 15) {
          // US Praktik
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF9A3412' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFF7ED' : 'FFFFFFFF' } };
          cell.numFmt = '0.00';
        } else if (colNumber === 16) {
          // Rerata US
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFDCFCE7' : 'FFF0FDF4' } };
          cell.numFmt = '0.00';
        } else {
          // Nilai Akhir
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFB91C1C' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFEE2E2' : 'FFFEF2F2' } };
          cell.numFmt = '0.00';
        }
      });
    });

    const lastDataRow = startDataRow + targetStudents.length - 1;

    // --- FOOTER ROW: STATISTIK KELAS (RATA-RATA, MAX, MIN) ---
    if (targetStudents.length > 0) {
      // 1. RATA-RATA KELAS
      const avgRowValues: any[] = ['RATA-RATA KELAS', '', '', '', '', ''];
      for (let i = 7; i <= totalCols; i++) {
        const colLetter = ws.getColumn(i).letter;
        avgRowValues.push({ formula: `AVERAGE(${colLetter}${startDataRow}:${colLetter}${lastDataRow})` });
      }

      const avgRow = ws.addRow(avgRowValues);
      ws.mergeCells(lastDataRow + 1, 1, lastDataRow + 1, 6);
      avgRow.height = 24;

      avgRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF0F3D64' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.numFmt = '0.00';
        }
      });

      // 2. NILAI TERTINGGI (MAX)
      const maxRowValues: any[] = ['NILAI TERTINGGI (MAX)', '', '', '', '', ''];
      for (let i = 7; i <= totalCols; i++) {
        const colLetter = ws.getColumn(i).letter;
        maxRowValues.push({ formula: `MAX(${colLetter}${startDataRow}:${colLetter}${lastDataRow})` });
      }

      const maxRow = ws.addRow(maxRowValues);
      ws.mergeCells(lastDataRow + 2, 1, lastDataRow + 2, 6);
      maxRow.height = 22;

      maxRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF166534' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.numFmt = '0.00';
        }
      });

      // 3. NILAI TERENDAH (MIN)
      const minRowValues: any[] = ['NILAI TERENDAH (MIN)', '', '', '', '', ''];
      for (let i = 7; i <= totalCols; i++) {
        const colLetter = ws.getColumn(i).letter;
        minRowValues.push({ formula: `MIN(${colLetter}${startDataRow}:${colLetter}${lastDataRow})` });
      }

      const minRow = ws.addRow(minRowValues);
      ws.mergeCells(lastDataRow + 3, 1, lastDataRow + 3, 6);
      minRow.height = 22;

      minRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.numFmt = '0.00';
        }
      });
    }

    // --- PROPORTIONAL COLUMN WIDTHS ---
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nisn', width: 16 },
      { key: 'nis', width: 13 },
      { key: 'nama', width: 36 },
      { key: 'lp', width: 8 },
      { key: 'agama', width: 15 },
      { key: 's1', width: 10 },
      { key: 's2', width: 10 },
      { key: 's3', width: 10 },
      { key: 's4', width: 10 },
      { key: 's5', width: 10 },
      { key: 's6', width: 10 },
      { key: 'rerataRapor', width: 14 },
      { key: 'usTulis', width: 12 },
      { key: 'usPraktik', width: 12 },
      { key: 'rerataUs', width: 13 },
      { key: 'nilaiAkhir', width: 14 },
    ];

    // --- SHEET 2: PETUNJUK & PANDUAN PENGISIAN NILAI K9 ---
    const wsHelp = wb.addWorksheet('Petunjuk & Panduan K9', {
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const h1 = wsHelp.addRow(['PETUNJUK REKAPITULASI & PENGISIAN NILAI KELAS 9']);
    wsHelp.mergeCells('A1:D1');
    h1.height = 26;
    h1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
    h1.alignment = { vertical: 'middle', horizontal: 'center' };

    wsHelp.addRow([]);
    const guidelines = [
      ['1.', 'Kolom Identitas & Agama', 'Jangan mengubah urutan baris, NISN, atau Nama Siswa. Kolom Agama mempermudah guru mapel agama memeriksa siswa yang bersangkutan.'],
      ['2.', 'Nilai Rapor Semester 1 s.d. 6 (S1..S6)', 'Berisi nilai capaian rapor dari semester 1 sampai dengan semester 6 (rentang nilai 0 s.d. 100).'],
      ['3.', 'Rerata Rapor', 'Dihitung otomatis berdasarkan rata-rata murni seluruh semester 1 s.d. 6 (S1 s.d. S6).'],
      ['4.', 'Nilai Ujian Sekolah (US Tulis & Praktik)', 'Nilai Ujian Sekolah Tulis dan Ujian Sekolah Praktik (rentang 0 s.d. 100).'],
      ['5.', 'Rerata US', `Dihitung berdasarkan pembobotan Ujian Sekolah (Tulis ${bobotUsTulis}% : Praktik ${bobotUsPraktik}%).`],
      ['6.', 'Nilai Akhir (Sekolah)', `Dihitung berdasarkan pembobotan Nilai Akhir (Rata-rata Rapor ${bobotRataRapor}% : Rata-rata US ${bobotRataUs}%).`],
      ['7.', 'Pembedaan Agama Siswa', 'Bagi guru mata pelajaran Agama (PAI, PAK, Katolik, dll), data yang diekspor dapat disaring terlebih dahulu sesuai agama siswa atau diekspor secara menyeluruh.'],
      ['8.', 'Sinkronisasi / Impor Data', 'Jika berkas ini diedit secara offline, gunakan menu Import Excel pada aplikasi untuk memperbarui data ke sistem.'],
    ];

    guidelines.forEach(([num, title, desc]) => {
      const r = wsHelp.addRow([num, title, desc]);
      r.height = 24;
      r.getCell(1).font = { bold: true, color: { argb: 'FF1E40AF' } };
      r.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(3).font = { color: { argb: 'FF334155' } };
      r.alignment = { vertical: 'middle' };
    });

    wsHelp.columns = [
      { width: 6 },
      { width: 34 },
      { width: 84 },
    ];

    const safeTA = activeTA.tahun.replace(/[^a-zA-Z0-9]/g, '-');
    const agamaSuffix = selectedAgamaFilter === 'ALL' ? '' : `_${selectedAgamaFilter.replace(/[^a-zA-Z0-9]/g, '')}`;
    const fileName = `Nilai_K9_${selectedMapelObj?.kodeMapel || 'Mapel'}_${selectedKelasObj?.namaKelas || 'Kelas'}${agamaSuffix}_TA-${safeTA}-Sem${activeTA.semester}.xlsx`;
    await saveWorkbookK9(wb, fileName);
  };

  // Download Excel Import Template (Colored, Proportional, Dilengkapi Agama, Tanpa Rerata Rapor, Rerata US & Nilai Akhir)
  const handleDownloadTemplate = async () => {
    const selectedMapelObj = appState.mapelList.find((m) => m.id === selectedMapelId);
    const selectedKelasObj = appState.kelasList.find((k) => k.id === selectedKelasId);
    const activeTA = appState.tahunAjaranList.find((t) => t.id === appState.activeTahunAjaranId) || appState.tahunAjaranList[0];

    const targetStudents =
      selectedAgamaFilter === 'ALL'
        ? studentsInClass
        : studentsInClass.filter(
            (s) => (s.agama || 'Islam').trim().toLowerCase() === selectedAgamaFilter.toLowerCase()
          );

    const wb = new ExcelJS.Workbook();
    wb.creator = 'e-Dafnil SMP Negeri 2 Kemranjen';
    wb.lastModifiedBy = 'e-Dafnil Assessment System K9';
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet(`Template K9 - ${selectedMapelObj?.kodeMapel || 'Mapel'}`, {
      views: [{ showGridLines: true }],
      properties: { tabColor: { argb: 'FF2874A6' } },
    });

    const totalCols = 14; // No, NISN, NIS, Nama, L/P, Agama, S1, S2, S3, S4, S5, S6, US Tulis, US Praktik

    // Header Title
    const row1 = ws.addRow([`PEMERINTAH KABUPATEN ${appState.sekolah.kabupatenKota?.toUpperCase() || 'BANYUMAS'} - DINAS PENDIDIKAN`]);
    ws.mergeCells(1, 1, 1, totalCols);
    row1.height = 24;
    row1.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row1.alignment = { vertical: 'middle', horizontal: 'center' };
    row1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D64' } };

    const row2 = ws.addRow([`${appState.sekolah.namaSekolah?.toUpperCase() || 'SMP NEGERI 2 KEMRANJEN'} - TEMPLATE INPUT NILAI KELAS 9`]);
    ws.mergeCells(2, 1, 2, totalCols);
    row2.height = 28;
    row2.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    row2.alignment = { vertical: 'middle', horizontal: 'center' };
    row2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E80' } };

    const row3 = ws.addRow(['TEMPLATE FORMULIR ENTRI NILAI KELAS 9 (OFFLINE ENTRY)']);
    ws.mergeCells(3, 1, 3, totalCols);
    row3.height = 22;
    row3.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    row3.alignment = { vertical: 'middle', horizontal: 'center' };
    row3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    ws.addRow([]).height = 8;

    // --- ROW 5: METADATA ROW 1 (MATA PELAJARAN & KELAS) ---
    const row5 = ws.addRow([]);
    row5.height = 24;

    ws.mergeCells(5, 1, 5, 6);
    const cellMapel = ws.getCell(5, 1);
    cellMapel.value = `Mata Pelajaran: ${selectedMapelObj?.namaMapel || 'Semua Mata Pelajaran'} (${selectedMapelObj?.kodeMapel || '-'})`;
    cellMapel.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F3D64' } };
    cellMapel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells(5, 7, 5, totalCols);
    const cellKelas = ws.getCell(5, 7);
    cellKelas.value = `Kelas: ${selectedKelasObj?.namaKelas || '-'} (Wali Kelas: ${selectedKelasObj?.waliKelasNama || '-'})`;
    cellKelas.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cellKelas.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(5, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 6 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    // --- ROW 6: METADATA ROW 2 (TAHUN AJARAN & KOMPONEN) ---
    const row6 = ws.addRow([]);
    row6.height = 24;

    ws.mergeCells(6, 1, 6, 6);
    const cellTA = ws.getCell(6, 1);
    cellTA.value = `Tahun Ajaran: ${activeTA.tahun}  |  Semester: ${activeTA.semester}`;
    cellTA.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF334155' } };
    cellTA.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    ws.mergeCells(6, 7, 6, totalCols);
    const cellInfo = ws.getCell(6, 7);
    const filterDesc = selectedAgamaFilter === 'ALL' ? 'Semua Agama' : `Khusus Agama ${selectedAgamaFilter}`;
    cellInfo.value = `Target: ${targetStudents.length} Siswa (${filterDesc})  |  Komponen: S1..S6, US Tulis, US Praktik`;
    cellInfo.font = { name: 'Arial', size: 9.5, color: { argb: 'FF475569' } };
    cellInfo.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    for (let c = 1; c <= totalCols; c++) {
      const cell = ws.getCell(6, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 1 || c === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
        right: c === 6 || c === totalCols ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
      };
    }

    ws.addRow([]).height = 8;

    // Headers (No, NISN, NIS, Nama Siswa, L/P, Agama, S1..S6, US Tulis, US Praktik)
    const headerLabels = [
      'No',
      'NISN',
      'NIS',
      'Nama Siswa',
      'L/P',
      'Agama',
      'S1',
      'S2',
      'S3',
      'S4',
      'S5',
      'S6',
      'US Tulis',
      'US Praktik',
    ];

    const headerRow = ws.addRow(headerLabels);
    headerRow.height = 30;
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    headerRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF0F3D64' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0F3D64' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      if (colNumber <= 6) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber <= 12) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2874A6' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else if (colNumber === 13) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E8449' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD35400' } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      }
    });

    // Blank data rows with student identity filled in
    targetStudents.forEach((s, idx) => {
      const rowValues = [
        idx + 1,
        s.nisn || '',
        s.nis || '',
        s.nama || '',
        s.jenisKelamin || 'L',
        s.agama || 'Islam',
        '', // S1
        '', // S2
        '', // S3
        '', // S4
        '', // S5
        '', // S6
        '', // US Tulis
        '', // US Praktik
      ];

      const dataRow = ws.addRow(rowValues);
      dataRow.height = 23;

      const isEven = idx % 2 === 1;
      const rowBgColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

      dataRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 2 || colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF475569' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        } else if (colNumber === 6) {
          // Agama
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0369A1' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF0F9FF' : 'FFFFFFFF' } };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
      });
    });

    // Proportional column widths
    ws.columns = [
      { key: 'no', width: 6 },
      { key: 'nisn', width: 16 },
      { key: 'nis', width: 13 },
      { key: 'nama', width: 36 },
      { key: 'lp', width: 8 },
      { key: 'agama', width: 15 },
      { key: 's1', width: 10 },
      { key: 's2', width: 10 },
      { key: 's3', width: 10 },
      { key: 's4', width: 10 },
      { key: 's5', width: 10 },
      { key: 's6', width: 10 },
      { key: 'usTulis', width: 14 },
      { key: 'usPraktik', width: 14 },
    ];

    // --- SHEET 2: PETUNJUK & PANDUAN PENGISIAN TEMPLATE K9 ---
    const wsHelp = wb.addWorksheet('Petunjuk Pengisian Template', {
      properties: { tabColor: { argb: 'FF1E8449' } },
    });

    const h1 = wsHelp.addRow(['PANDUAN & PETUNJUK PENGISIAN TEMPLATE NILAI KELAS 9']);
    wsHelp.mergeCells('A1:D1');
    h1.height = 26;
    h1.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
    h1.alignment = { vertical: 'middle', horizontal: 'center' };

    wsHelp.addRow([]);
    const guidelines = [
      ['1.', 'Mata Pelajaran', `Template ini khusus untuk mata pelajaran: ${selectedMapelObj?.namaMapel || '-'} (${selectedMapelObj?.kodeMapel || '-'}).`],
      ['2.', 'Tahun Ajaran & Kelas', `Tahun Ajaran: ${activeTA.tahun} (Semester ${activeTA.semester}) | Kelas: ${selectedKelasObj?.namaKelas || '-'}.`],
      ['3.', 'Kolom Identitas & Agama Siswa', 'Jangan mengubah urutan baris, NISN, atau Nama Siswa agar proses sinkronisasi import data berjalan akurat.'],
      ['4.', 'Nilai Rapor Semester 1 s.d. 6 (S1..S6)', 'Isi nilai capaian rapor semester 1 sampai dengan semester 6 dalam rentang angka 0 s.d. 100.'],
      ['5.', 'Ujian Sekolah (US Tulis & Praktik)', 'Isi nilai Ujian Sekolah Tulis dan Ujian Sekolah Praktik (rentang 0 s.d. 100).'],
      ['6.', 'Perhitungan Otomatis', 'Rerata Rapor, Rerata US, dan Nilai Akhir (NA) akan dihitung secara otomatis oleh sistem aplikasi saat berkas diimpor.'],
      ['7.', 'Format Berkas', 'Simpan berkas dalam format .xlsx atau .xls sebelum melakukan proses Import Excel di aplikasi.'],
    ];

    guidelines.forEach(([num, title, desc]) => {
      const r = wsHelp.addRow([num, title, desc]);
      r.height = 24;
      r.getCell(1).font = { bold: true, color: { argb: 'FF1E40AF' } };
      r.getCell(2).font = { bold: true, color: { argb: 'FF0F172A' } };
      r.getCell(3).font = { color: { argb: 'FF334155' } };
      r.alignment = { vertical: 'middle' };
    });

    wsHelp.columns = [
      { width: 6 },
      { width: 34 },
      { width: 84 },
    ];

    const safeTA = activeTA.tahun.replace(/[^a-zA-Z0-9]/g, '-');
    const agamaSuffix = selectedAgamaFilter === 'ALL' ? '' : `_${selectedAgamaFilter.replace(/[^a-zA-Z0-9]/g, '')}`;
    const fileName = `Template_Nilai_K9_${selectedMapelObj?.kodeMapel || 'Mapel'}_${selectedKelasObj?.namaKelas || 'Kelas'}${agamaSuffix}_TA-${safeTA}-Sem${activeTA.semester}.xlsx`;
    await saveWorkbookK9(wb, fileName);
  };

  // Handle Import File Selection (Supports both styled & simple formats)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (!rawData || rawData.length === 0) {
          setImportError('File Excel kosong atau tidak memiliki format data yang valid.');
          return;
        }

        // Search for header row containing NISN or Nama
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const rowStr = JSON.stringify(rawData[i] || []).toLowerCase();
          if (rowStr.includes('nisn') || rowStr.includes('nama')) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          setImportError('Tidak dapat menemukan baris judul header (NISN / Nama Siswa) pada berkas Excel.');
          return;
        }

        const headersArr: string[] = (rawData[headerRowIdx] || []).map((h) =>
          String(h || '').trim().toLowerCase()
        );

        const nisnCol = headersArr.findIndex((h) => h.includes('nisn'));
        const namaCol = headersArr.findIndex((h) => h.includes('nama'));
        const s1Col = headersArr.findIndex((h) => h === 's1' || h.includes('sem 1') || h.includes('semester 1'));
        const s2Col = headersArr.findIndex((h) => h === 's2' || h.includes('sem 2') || h.includes('semester 2'));
        const s3Col = headersArr.findIndex((h) => h === 's3' || h.includes('sem 3') || h.includes('semester 3'));
        const s4Col = headersArr.findIndex((h) => h === 's4' || h.includes('sem 4') || h.includes('semester 4'));
        const s5Col = headersArr.findIndex((h) => h === 's5' || h.includes('sem 5') || h.includes('semester 5'));
        const s6Col = headersArr.findIndex((h) => h === 's6' || h.includes('sem 6') || h.includes('semester 6'));
        const usTulisCol = headersArr.findIndex((h) => h.includes('tulis'));
        const usPraktikCol = headersArr.findIndex((h) => h.includes('praktik'));

        const parsedList: Array<{
          siswaId: string;
          nama: string;
          nisn: string;
          agama?: string;
          jenisKelamin?: string;
          detail: K9MapelDetail;
        }> = [];

        for (let i = headerRowIdx + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || '').toLowerCase();
          if (firstCell.includes('rata') || firstCell.includes('jumlah') || firstCell.includes('tinggi') || firstCell.includes('rendah')) {
            continue;
          }

          const nisnStr = String(row[nisnCol] ?? '').trim();
          const namaStr = String(row[namaCol] ?? '').trim();

          if (!nisnStr && !namaStr) continue;

          const student = studentsInClass.find(
            (s) =>
              (nisnStr && s.nisn === nisnStr) ||
              (namaStr && s.nama.toLowerCase().trim() === namaStr.toLowerCase().trim())
          );

          if (student) {
            const parseVal = (colIdx: number, defaultVal = 0) => {
              if (colIdx === -1) return defaultVal;
              const val = parseInt(String(row[colIdx] ?? '0'));
              return isNaN(val) ? defaultVal : Math.min(100, Math.max(0, val));
            };

            const s1 = parseVal(s1Col, 80);
            const s2 = parseVal(s2Col, 80);
            const s3 = parseVal(s3Col, 80);
            const s4 = parseVal(s4Col, 80);
            const s5 = parseVal(s5Col, 80);
            const s6 = parseVal(s6Col, 80);
            const usTulis = parseVal(usTulisCol, 80);
            const usPraktik = parseVal(usPraktikCol, 80);

            parsedList.push({
              siswaId: student.id,
              nama: student.nama,
              nisn: student.nisn,
              agama: student.agama || 'Islam',
              jenisKelamin: student.jenisKelamin || 'L',
              detail: { s1, s2, s3, s4, s5, s6, usTulis, usPraktik },
            });
          }
        }

        if (parsedList.length === 0) {
          setImportError(
            'Tidak ada nama siswa atau NISN pada file Excel yang cocok dengan daftar siswa kelas ini.'
          );
        } else {
          setImportPreview(parsedList);
        }
      } catch (err) {
        setImportError('Gagal membaca file Excel. Pastikan format file .xlsx / .xls valid.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Confirm Import
  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;

    setGridData((prev) => {
      const nextGrid = { ...prev };
      importPreview.forEach((item) => {
        nextGrid[item.siswaId] = item.detail;
      });
      return nextGrid;
    });

    setSavedStatusMap({});
    setShowImportModal(false);
    setImportFile(null);
    setImportPreview([]);
    setGlobalSavedSuccess(false);
    setMassResetSuccessNotice(false);
  };

  const editingStudentObj = studentsInClass.find((s) => s.id === editingStudentId);
  const resetStudentObj = studentsInClass.find((s) => s.id === resetConfirmStudentId);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
                <GraduationCap className="text-blue-600" size={24} />
                <span>Input Nilai Kelulusan Kelas 9 (K9)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Pengolahan Nilai Rapor Semester 1 s.d 6 dan Nilai Ujian Sekolah (Tulis & Praktik) untuk penetapan Nilai Akhir.
              </p>
            </div>

            {/* Header Actions: Unduh Template, Excel Export/Import, Reset Massal & Save All */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Tombol Unduh Template */}
              <button
                onClick={handleDownloadTemplate}
                className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                title={`Unduh Template Excel Kosong untuk Mapel ${selectedMapelObj?.namaMapel || ''} - ${selectedKelasObj?.namaKelas || ''}`}
              >
                <FileDown size={15} />
                <span>Unduh Template</span>
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                title={`Eksport Rekapitulasi Data Nilai K9 (${selectedMapelObj?.namaMapel || ''}) ke MS Excel`}
              >
                <Download size={15} />
                <span>Eksport Excel</span>
              </button>

              <button
                onClick={() => {
                  setShowImportModal(true);
                  setImportFile(null);
                  setImportPreview([]);
                  setImportError(null);
                }}
                className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                title="Import data nilai K9 dari file MS Excel"
              >
                <Upload size={15} />
                <span>Import Excel</span>
              </button>

              {/* Tombol Reset Massal ke 0 */}
              <button
                onClick={() => setShowMassResetModal(true)}
                className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                title="Reset massal seluruh nilai siswa (S1-S6, US Tulis & Praktik) di kelas dan mapel ini menjadi nol (0)"
              >
                <RotateCcw size={15} />
                <span>Reset Massal (0)</span>
              </button>

              <button
                onClick={handleSaveAll}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Save size={15} />
                <span>Simpan Semua</span>
              </button>
            </div>
          </div>

      {/* Wali Kelas 9 Badge Banner */}
      {isGuru && waliKelas9Obj && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-xs border border-blue-700/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/15 rounded-xl">
              <ShieldCheck size={18} className="text-emerald-300" />
            </div>
            <div>
              <span className="text-xs font-extrabold text-white">
                Akses Wali Kelas 9: {waliKelas9Obj.namaKelas}
              </span>
              <p className="text-[11px] text-blue-200">
                Wali Kelas: {waliKelas9Obj.waliKelasNama} • Memiliki wewenang mengelola data kelulusan & cetak dokumen kelas 9.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedKelasId(waliKelas9Obj.id)}
            className="text-[11px] font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            Pilih Rombel ({waliKelas9Obj.kodeKelas})
          </button>
        </div>
      )}

      {/* Filter Selection Bar */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Rombel Kelas 9
            </label>
            <select
              value={selectedKelasId}
              onChange={(e) => setSelectedKelasId(e.target.value)}
              className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden"
            >
              {kelas9List.length > 0 ? (
                kelas9List.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.namaKelas} (Wali: {k.waliKelasNama})
                  </option>
                ))
              ) : (
                appState.kelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.namaKelas}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Mata Pelajaran
            </label>
            <select
              value={selectedMapelId}
              onChange={(e) => setSelectedMapelId(e.target.value)}
              className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden"
            >
              {appState.mapelList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.namaMapel} ({m.kodeMapel})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Filter size={13} className="text-blue-600" />
                <span>Filter Agama Siswa</span>
              </span>
              {isMapelAgama && (
                <span className="text-[10px] text-amber-700 bg-amber-100 font-extrabold px-1.5 py-0.2 rounded">
                  Mapel Agama
                </span>
              )}
            </label>
            <select
              value={selectedAgamaFilter}
              onChange={(e) => setSelectedAgamaFilter(e.target.value)}
              className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden"
            >
              <option value="ALL">Semua Agama ({studentsInClass.length} Siswa)</option>
              {Object.entries(agamaStats).map(([agama, count]) => (
                <option key={agama} value={agama}>
                  Agama {agama} ({count} Siswa)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Religion Filter Tabs */}
        {Object.keys(agamaStats).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/60">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Users size={12} />
              Filter Cepat Agama:
            </span>
            <button
              onClick={() => setSelectedAgamaFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                selectedAgamaFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>Semua</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${selectedAgamaFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {studentsInClass.length}
              </span>
            </button>
            {Object.entries(agamaStats).map(([agama, count]) => {
              const isActive = selectedAgamaFilter === agama;
              const badgeStyle = getAgamaBadgeStyle(agama);
              return (
                <button
                  key={agama}
                  onClick={() => setSelectedAgamaFilter(agama)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : `${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} hover:opacity-80`
                  }`}
                >
                  <span>{agama}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-black/10'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Highlight Metadata Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              Mapel: {selectedMapelObj?.namaMapel} ({selectedMapelObj?.kodeMapel})
            </span>
            <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              T.A {activeTA.tahun} • Semester {activeTA.semester}
            </span>
            <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              Kelas {selectedKelasObj?.namaKelas} ({displayedStudents.length} / {studentsInClass.length} Siswa)
            </span>
            {selectedAgamaFilter !== 'ALL' && (
              <span className="font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
                <Filter size={11} />
                Khusus Agama {selectedAgamaFilter}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Format Ekspor & Unduh Template mendukung filter agama dan seluruh mata pelajaran.
          </div>
        </div>
      </div>

      {/* Pengaturan Bobot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Pengaturan Bobot Ujian Sekolah (US) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2">
            <Settings size={18} className="text-blue-600" />
            <span>Pengaturan Bobot Nilai Ujian Sekolah (US)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Bobot US Tulis (%)
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bobotUsTulis}
                  onChange={(e) => setBobotUsTulis(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Bobot US Praktik (%)
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bobotUsPraktik}
                  onChange={(e) => setBobotUsPraktik(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 font-medium flex items-center justify-between">
            <span>Formula Rerata US (2 Desimal):</span>
            <span className="font-extrabold font-mono text-blue-700">
              ({bobotUsTulis}% Tulis + {bobotUsPraktik}% Praktik) / {bobotUsTulis + bobotUsPraktik}%
            </span>
          </div>
        </div>

        {/* Card 2: Pengaturan Bobot Rerata Rapor dan Rerata US */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2">
            <Calculator size={18} className="text-emerald-600" />
            <span>Pengaturan Bobot Nilai Akhir (NA)</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Bobot Rerata Rapor (%)
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bobotRataRapor}
                  onChange={(e) => setBobotRataRapor(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Bobot Rerata US (%)
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bobotRataUs}
                  onChange={(e) => setBobotRataUs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-hidden"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-900 font-medium flex items-center justify-between">
            <span>Formula Nilai Akhir NA (2 Desimal):</span>
            <span className="font-extrabold font-mono text-emerald-700">
              ({bobotRataRapor}% Rapor + {bobotRataUs}% US) / {bobotRataRapor + bobotRataUs}%
            </span>
          </div>
        </div>
      </div>

      {globalSavedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
          <CheckCircle size={18} className="shrink-0 text-emerald-600" />
          <span>
            Seluruh data nilai K9 {selectedMapelObj?.namaMapel} untuk kelas{' '}
            {selectedKelasObj?.namaKelas} berhasil disimpan ke database!
          </span>
        </div>
      )}

      {massResetSuccessNotice && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <RotateCcw size={18} className="shrink-0 text-amber-600" />
            <span>
              Seluruh nilai K9 (Semester 1–6, US Tulis & Praktik) untuk rombel{' '}
              <strong>{selectedKelasObj?.namaKelas}</strong> mapel{' '}
              <strong>{selectedMapelObj?.namaMapel}</strong> telah di-reset menjadi <strong>0</strong>. Klik tombol <strong>Simpan Semua</strong> untuk menyimpan perubahan ke database.
            </span>
          </div>
          <button
            onClick={() => setMassResetSuccessNotice(false)}
            className="text-amber-700 hover:text-amber-900 p-1 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabel Input Nilai K9 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
            <span>Lembar Penilaian K9 - Mapel: {selectedMapelObj?.namaMapel} ({selectedKelasObj?.namaKelas})</span>
            {selectedAgamaFilter !== 'ALL' && (
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-extrabold normal-case">
                Agama: {selectedAgamaFilter}
              </span>
            )}
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Menampilkan <strong>{displayedStudents.length}</strong> dari {studentsInClass.length} Siswa | Format Rerata & NA: <strong>2 Digit Desimal</strong>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse">
            <thead>
              {/* Group Header Row */}
              <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200">
                <th rowSpan={2} className="border-r border-slate-200 p-2.5 w-10">
                  Urutan
                </th>
                <th rowSpan={2} className="border-r border-slate-200 p-2.5 text-left min-w-[190px]">
                  Nama Siswa & Agama
                </th>
                <th colSpan={6} className="border-r border-slate-200 p-2 bg-blue-50/50 text-blue-900">
                  Nilai Rapor (Terdiri dari 6 Semester)
                </th>
                <th rowSpan={2} className="border-r border-slate-200 p-2 w-24 bg-blue-100/60 text-blue-950 font-black">
                  Rerata Rapor
                </th>
                <th colSpan={2} className="border-r border-slate-200 p-2 bg-emerald-50/50 text-emerald-900">
                  Ujian Sekolah (US)
                </th>
                <th rowSpan={2} className="border-r border-slate-200 p-2 w-24 bg-emerald-100/60 text-emerald-950 font-black">
                  Rerata US
                </th>
                <th rowSpan={2} className="border-r border-slate-200 p-2 w-24 bg-amber-100/80 text-amber-950 font-black">
                  Nilai Akhir
                </th>
                <th rowSpan={2} className="p-2 w-32">
                  Aksi
                </th>
              </tr>

              {/* Sub-Header Row */}
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                {/* Rapor Semesters */}
                <th className="border-r border-slate-200 p-1.5 w-12">S1</th>
                <th className="border-r border-slate-200 p-1.5 w-12">S2</th>
                <th className="border-r border-slate-200 p-1.5 w-12">S3</th>
                <th className="border-r border-slate-200 p-1.5 w-12">S4</th>
                <th className="border-r border-slate-200 p-1.5 w-12">S5</th>
                <th className="border-r border-slate-200 p-1.5 w-12">S6</th>

                {/* Ujian Sekolah */}
                <th className="border-r border-slate-200 p-1.5 w-14">Tulis</th>
                <th className="border-r border-slate-200 p-1.5 w-14">Praktik</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-slate-400">
                    {studentsInClass.length === 0
                      ? 'Tidak ada siswa terdaftar di rombel kelas 9 ini.'
                      : `Tidak ada siswa dengan agama "${selectedAgamaFilter}" di rombel kelas ini.`}
                  </td>
                </tr>
              ) : (
                displayedStudents.map((s, idx) => {
                  const detail = gridData[s.id] || {
                    s1: 85,
                    s2: 85,
                    s3: 85,
                    s4: 85,
                    s5: 85,
                    s6: 85,
                    usTulis: 85,
                    usPraktik: 85,
                  };

                  const rerataRapor = calculateRerataRapor(detail);
                  const rerataUS = calculateRerataUS(detail);
                  const nilaiAkhir = calculateNilaiAkhir(detail);
                  const isSaved = savedStatusMap[s.id];
                  const badgeStyle = getAgamaBadgeStyle(s.agama || 'Islam');

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Urutan */}
                      <td className="border-r border-slate-100 p-2 font-bold text-slate-400 text-center">
                        {idx + 1}
                      </td>

                      {/* Nama Siswa & Agama */}
                      <td className="border-r border-slate-100 p-2.5 text-left">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="font-bold text-slate-900">{s.nama}</div>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border} shrink-0`}
                          >
                            {s.agama || 'Islam'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                          <span>NISN: {s.nisn}</span>
                          <span>•</span>
                          <span>JK: {s.jenisKelamin || 'L'}</span>
                        </div>
                      </td>

                      {/* Semester 1 - 6 Inputs */}
                      {(['s1', 's2', 's3', 's4', 's5', 's6'] as const).map((sem) => (
                        <td key={sem} className="border-r border-slate-100 p-1 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={detail[sem]}
                            onChange={(e) => handleScoreChange(s.id, sem, e.target.value)}
                            className="w-11 text-center font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-md py-1 text-xs focus:bg-white focus:outline-hidden"
                          />
                        </td>
                      ))}

                      {/* Rerata Rapor (2 Desimal) */}
                      <td className="border-r border-slate-100 p-2 font-mono font-black text-blue-900 bg-blue-50/40 text-center">
                        {rerataRapor}
                      </td>

                      {/* US Tulis */}
                      <td className="border-r border-slate-100 p-1 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={detail.usTulis}
                          onChange={(e) => handleScoreChange(s.id, 'usTulis', e.target.value)}
                          className="w-12 text-center font-bold text-emerald-800 bg-emerald-50/40 border border-emerald-200 rounded-md py-1 text-xs focus:bg-white focus:outline-hidden"
                        />
                      </td>

                      {/* US Praktik */}
                      <td className="border-r border-slate-100 p-1 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={detail.usPraktik}
                          onChange={(e) => handleScoreChange(s.id, 'usPraktik', e.target.value)}
                          className="w-12 text-center font-bold text-emerald-800 bg-emerald-50/40 border border-emerald-200 rounded-md py-1 text-xs focus:bg-white focus:outline-hidden"
                        />
                      </td>

                      {/* Rerata US (2 Desimal) */}
                      <td className="border-r border-slate-100 p-2 font-mono font-black text-emerald-900 bg-emerald-50/40 text-center">
                        {rerataUS}
                      </td>

                      {/* Nilai Akhir (2 Desimal) */}
                      <td className="border-r border-slate-100 p-2 font-mono font-black text-amber-950 bg-amber-100/60 text-sm text-center">
                        {nilaiAkhir}
                      </td>

                      {/* Aksi Column: Edit Nilai Manual & Reset Nilai */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Edit Nilai Manual Button */}
                          <button
                            onClick={() => handleOpenEditManual(s.id)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer shrink-0"
                            title="Edit nilai manual per komponen"
                          >
                            <Edit3 size={11} />
                            <span>Edit Manual</span>
                          </button>

                          {/* Save / Status Button */}
                          <button
                            onClick={() => handleSaveStudent(s.id)}
                            className={`p-1 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center cursor-pointer ${
                              isSaved
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                            }`}
                            title={isSaved ? 'Tersimpan' : 'Simpan Nilai'}
                          >
                            {isSaved ? <Check size={12} /> : <Save size={12} />}
                          </button>

                          {/* Reset Nilai Individual Button */}
                          <button
                            onClick={() => setResetConfirmStudentId(s.id)}
                            className="px-1.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition-all flex items-center space-x-1 cursor-pointer shrink-0"
                            title="Reset nilai siswa ini menjadi 0"
                          >
                            <RotateCcw size={11} />
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

        {/* Bottom Actions Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Rerata Nilai Rapor, Rerata Ujian Sekolah (US), dan Nilai Akhir (NA) dihitung secara presisi dalam format <strong>2 digit desimal</strong>.
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowMassResetModal(true)}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Reset Massal (0)</span>
            </button>
            <button
              onClick={handleSaveAll}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all flex items-center space-x-1.5"
            >
              <Save size={15} />
              <span>Simpan Nilai K9 Kelas {selectedKelasObj?.namaKelas}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Keterangan & Rumus Penilaian di Bawahnya */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-2">
          <Info size={20} className="text-blue-600 shrink-0" />
          <span>Keterangan & Petunjuk Pengolahan Nilai Kelulusan Kelas 9 (K9)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Rumus 1 */}
          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
            <div className="font-extrabold text-blue-900 flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                1
              </span>
              <span>Rerata Nilai Rapor</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px] font-mono font-medium pt-1">
              (Semester 1 + Semester 2 + Semester 3 + Semester 4 + Semester 5 + Semester 6) ÷ 6
            </p>
            <p className="text-[10px] text-slate-400 pt-1">
              *Rata-rata murni dari 6 semester (2 desimal).
            </p>
          </div>

          {/* Rumus 2 */}
          <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
            <div className="font-extrabold text-emerald-900 flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                2
              </span>
              <span>Rerata Ujian Sekolah (US)</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px] font-mono font-medium pt-1">
              ((US Tulis × {bobotUsTulis}%) + (US Praktik × {bobotUsPraktik}%)) ÷ {bobotUsTulis + bobotUsPraktik}%
            </p>
            <p className="text-[10px] text-slate-400 pt-1">
              *Dihitung berdasarkan pembobotan nilai ujian tulis dan ujian praktik (2 desimal).
            </p>
          </div>

          {/* Rumus 3 */}
          <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1">
            <div className="font-extrabold text-amber-900 flex items-center space-x-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-mono text-[10px] flex items-center justify-center shrink-0">
                3
              </span>
              <span>Nilai Akhir (NA)</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px] font-mono font-medium pt-1">
              ((Rerata Rapor × {bobotRataRapor}%) + (Rerata US × {bobotRataUs}%)) ÷ {bobotRataRapor + bobotRataUs}%
            </p>
            <p className="text-[10px] text-slate-400 pt-1">
              *Nilai akhir pada penulisan SKL & Transkrip Kelulusan (2 desimal).
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1 leading-relaxed">
          <div className="font-bold text-slate-800 flex items-center space-x-1.5">
            <HelpCircle size={14} className="text-slate-500" />
            <span>Petunjuk Pengisian Data:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
            <li>
              Pilih Rombel Kelas 9 dan Mata Pelajaran terlebih dahulu di bagian atas lembar nilai.
            </li>
            <li>
              Gunakan tombol <strong>Reset Massal (0)</strong> untuk mengosongkan semua nilai rombel aktif sekaligus menjadi 0.
            </li>
            <li>
              Gunakan tombol <strong>Eksport Excel</strong> untuk mengunduh rekap nilai, dan <strong>Import Excel</strong> untuk mengunggah file nilai kolektif dari MS Excel.
            </li>
            <li>
              Pada kolom Aksi, klik <strong>Edit Manual</strong> untuk pengeditan terperinci per siswa, atau <strong>Reset</strong> untuk mengosongkan nilai siswa tersebut.
            </li>
            <li>
              Klik tombol <strong>Simpan Semua</strong> untuk memperbarui database kelulusan secara keseluruhan.
            </li>
          </ul>
        </div>
      </div>

      {/* Modal: Edit Nilai Manual per Siswa */}
      {editingStudentId && editFormDetail && editingStudentObj && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                  <Edit3 className="text-amber-600" size={18} />
                  <span>Edit Nilai Manual K9 - {editingStudentObj.nama}</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  NISN: {editingStudentObj.nisn} | Mapel: {selectedMapelObj?.namaMapel}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingStudentId(null);
                  setEditFormDetail(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Fields for 6 Semesters */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                1. Nilai Rapor (Semester 1 s.d 6)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(['s1', 's2', 's3', 's4', 's5', 's6'] as const).map((sem, i) => (
                  <div key={sem}>
                    <label className="block text-[10px] font-bold text-slate-500 text-center mb-1">
                      Sem {i + 1}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editFormDetail[sem]}
                      onChange={(e) =>
                        setEditFormDetail({
                          ...editFormDetail,
                          [sem]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                        })
                      }
                      className="w-full text-center font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl py-2 text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Form Fields for US Tulis & US Praktik */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-emerald-900 uppercase tracking-wider">
                2. Ujian Sekolah (US)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    US Tulis ({bobotUsTulis}%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editFormDetail.usTulis}
                    onChange={(e) =>
                      setEditFormDetail({
                        ...editFormDetail,
                        usTulis: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                      })
                    }
                    className="w-full text-center font-bold text-emerald-900 bg-emerald-50/50 border border-emerald-200 rounded-xl py-2 text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    US Praktik ({bobotUsPraktik}%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editFormDetail.usPraktik}
                    onChange={(e) =>
                      setEditFormDetail({
                        ...editFormDetail,
                        usPraktik: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                      })
                    }
                    className="w-full text-center font-bold text-emerald-900 bg-emerald-50/50 border border-emerald-200 rounded-xl py-2 text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Live Real-Time Result Preview (2 Desimal) */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-3 text-center gap-2">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Rerata Rapor</p>
                <p className="text-base font-mono font-black text-blue-700 mt-0.5">
                  {calculateRerataRapor(editFormDetail)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Rerata US</p>
                <p className="text-base font-mono font-black text-emerald-700 mt-0.5">
                  {calculateRerataUS(editFormDetail)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Nilai Akhir (NA)</p>
                <p className="text-base font-mono font-black text-amber-700 mt-0.5">
                  {calculateNilaiAkhir(editFormDetail)}
                </p>
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setEditingStudentId(null);
                  setEditFormDetail(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditManual}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <Save size={14} />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Reset Single Student Nilai */}
      {resetConfirmStudentId && resetStudentObj && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <RotateCcw size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Reset Nilai Siswa</h3>
                <p className="text-xs text-slate-500">{resetStudentObj.nama}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin mereset seluruh komponen nilai K9 (Semester 1–6, US Tulis &
              Praktik) untuk siswa <strong>{resetStudentObj.nama}</strong> pada mapel{' '}
              <strong>{selectedMapelObj?.namaMapel}</strong> menjadi 0?
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setResetConfirmStudentId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => handleConfirmResetStudent(resetConfirmStudentId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Ya, Reset Nilai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Reset Massal Semua Nilai ke 0 */}
      {showMassResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reset Massal Semua Nilai ke 0?</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan mengosongkan nilai seluruh siswa aktif</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl text-xs text-slate-700 space-y-2">
              <p>
                Anda akan mengatur seluruh nilai siswa menjadi <strong>0</strong>:
              </p>
              <ul className="list-disc pl-5 font-bold text-rose-950 space-y-0.5">
                <li>Nilai Rapor Semester 1 s.d. Semester 6 = <strong>0</strong></li>
                <li>Ujian Sekolah Tulis = <strong>0</strong></li>
                <li>Ujian Sekolah Praktik = <strong>0</strong></li>
              </ul>
              <p className="text-[11px] text-slate-500 pt-1">
                Berlaku untuk <strong>{displayedStudents.length}</strong> siswa {selectedAgamaFilter !== 'ALL' ? `(khusus Agama ${selectedAgamaFilter})` : ''} kelas <strong>{selectedKelasObj?.namaKelas}</strong> pada mata pelajaran <strong>{selectedMapelObj?.namaMapel}</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMassResetModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmMassReset}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 transition cursor-pointer flex items-center space-x-1.5"
              >
                <RotateCcw size={15} />
                <span>Ya, Reset Massal ke Nol</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import Excel */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-extrabold text-base">
                <FileSpreadsheet className="text-emerald-600" size={22} />
                <span>Import Data Nilai K9 dari MS Excel</span>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/60 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-bold flex items-center space-x-1.5 text-emerald-900">
                  <FileDown size={16} className="text-emerald-700" />
                  <span className="text-sm">Langkah 1: Unduh Template Excel Pre-filled</span>
                </div>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300">
                  {activeTA.tahun} • Sem. {activeTA.semester}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 font-bold text-[11px]">
                <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-900">
                  Mapel: {selectedMapelObj?.namaMapel} ({selectedMapelObj?.kodeMapel})
                </span>
                <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-900">
                  Kelas: {selectedKelasObj?.namaKelas}
                </span>
                <span className="bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-200 text-emerald-900">
                  {displayedStudents.length} Siswa {selectedAgamaFilter !== 'ALL' ? `(Agama ${selectedAgamaFilter})` : 'Terdaftar'}
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Unduh format spreadsheet <strong>.xlsx</strong> resmi yang sudah terisi data identitas siswa (termasuk kolom Agama). Berkas dilengkapi lembar panduan pengisian offline dan mendukung seluruh mata pelajaran.
              </p>

              <button
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 cursor-pointer mt-1"
              >
                <FileDown size={14} />
                <span>Unduh Template Excel ({selectedMapelObj?.kodeMapel || 'Mapel'}{selectedAgamaFilter !== 'ALL' ? ` - ${selectedAgamaFilter}` : ''})</span>
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Langkah 2: Pilih File Excel (.xlsx / .xls)
              </label>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-xl p-1 cursor-pointer"
              />
            </div>

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center space-x-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Pratinjau Data Terbaca ({importPreview.length} Siswa Match):</span>
                  <span className="text-emerald-600">Format Valid ✓</span>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-[11px]">
                  {importPreview.map((item, i) => {
                    const badge = getAgamaBadgeStyle(item.agama || 'Islam');
                    return (
                      <div
                        key={item.siswaId}
                        className="p-2 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">
                            {i + 1}. {item.nama}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {item.agama}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            NISN: {item.nisn}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-slate-600 font-bold space-x-1 shrink-0">
                          <span className="bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded-sm">
                            S1-S6: {item.detail.s1},{item.detail.s2},{item.detail.s3},{item.detail.s4},
                            {item.detail.s5},{item.detail.s6}
                          </span>
                          <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded-sm">
                            US: {item.detail.usTulis}/{item.detail.usPraktik}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                disabled={importPreview.length === 0}
                onClick={handleConfirmImport}
                className={`px-5 py-2 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                  importPreview.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-300 cursor-not-allowed'
                }`}
              >
                <CheckSquare size={14} />
                <span>Terapkan Import Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
