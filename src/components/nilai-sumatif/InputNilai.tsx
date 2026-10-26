import React, { useState, useEffect, useMemo } from 'react';
import { AppState, AuthUser, NilaiSumatif, NotificationLog, ClassSumatifConfig } from '../../types';
import { createNotification } from '../../lib/storage';
import { ExcelNilaiModal } from './ExcelNilaiModal';
import {
  Calculator,
  Save,
  CheckCircle,
  FileSpreadsheet,
  Settings2,
  ListOrdered,
  Percent,
  Sliders,
  Info,
  RotateCcw,
  AlertTriangle,
  X,
  BookOpen,
  UserCheck,
  ShieldAlert,
  Filter,
  Users,
  Copy,
  Check,
  Layers,
  Sparkles,
} from 'lucide-react';

export const STORAGE_SUMATIF_CONFIG_KEY = 'sipenis_sumatif_config_by_class_v1';

export const getSumatifConfigKey = (kelasId: string, mapelId: string) => {
  return `${kelasId}__${mapelId}`;
};

export const getSumatifConfigForClass = (
  kelasId: string,
  mapelId: string,
  configMap: Record<string, ClassSumatifConfig>,
  nilaiList: NilaiSumatif[],
  ta: { tahun: string; semester: 'Ganjil' | 'Genap' }
): ClassSumatifConfig => {
  const compositeKey = getSumatifConfigKey(kelasId, mapelId);
  if (configMap && configMap[compositeKey]) {
    return configMap[compositeKey];
  }
  if (configMap && configMap[kelasId]) {
    return configMap[kelasId];
  }

  // Check saved records in appState for this class and mapel
  const matchingRecords = (nilaiList || []).filter(
    (n) =>
      n.kelasId === kelasId &&
      n.mapelId === mapelId &&
      n.tahunAjaran === ta.tahun &&
      String(n.semester) === String(ta.semester)
  );

  let detectedCount = 3;
  let detectedBobotS = 2;
  let detectedBobotSTS = 1;
  let detectedBobotSAS = 1;
  let hasFound = false;

  for (const r of matchingRecords) {
    if (r.bobotS !== undefined && r.bobotS !== null) {
      detectedBobotS = Number(r.bobotS);
      hasFound = true;
    }
    if (r.bobotSTS !== undefined && r.bobotSTS !== null) {
      detectedBobotSTS = Number(r.bobotSTS);
      hasFound = true;
    }
    if (r.bobotSAS !== undefined && r.bobotSAS !== null) {
      detectedBobotSAS = Number(r.bobotSAS);
      hasFound = true;
    }
    if (r.jumlahSumatif !== undefined && r.jumlahSumatif !== null && r.jumlahSumatif > 0) {
      detectedCount = Number(r.jumlahSumatif);
      hasFound = true;
    } else if (r.tps && Array.isArray(r.tps) && r.tps.length > 0) {
      detectedCount = Math.max(detectedCount, r.tps.length);
      hasFound = true;
    }
    if (hasFound) break;
  }

  return {
    jumlahSumatif: Math.min(10, Math.max(1, detectedCount)),
    bobotS: detectedBobotS,
    bobotSTS: detectedBobotSTS,
    bobotSAS: detectedBobotSAS,
  };
};

export const getAgamaBadge = (agamaStr?: string) => {
  const ag = (agamaStr || 'Islam').trim().toLowerCase();
  switch (ag) {
    case 'islam':
      return {
        label: 'Islam',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'kristen':
    case 'kristen protestan':
      return {
        label: 'Kristen',
        bg: 'bg-sky-50 text-sky-700 border-sky-200',
        dot: 'bg-sky-500',
      };
    case 'katolik':
      return {
        label: 'Katolik',
        bg: 'bg-purple-50 text-purple-700 border-purple-200',
        dot: 'bg-purple-500',
      };
    case 'hindu':
      return {
        label: 'Hindu',
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'buddha':
      return {
        label: 'Buddha',
        bg: 'bg-orange-50 text-orange-700 border-orange-200',
        dot: 'bg-orange-500',
      };
    case 'khonghucu':
      return {
        label: 'Khonghucu',
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
      };
    default:
      return {
        label: agamaStr || 'Islam',
        bg: 'bg-slate-50 text-slate-700 border-slate-200',
        dot: 'bg-slate-500',
      };
  }
};

interface InputNilaiProps {
  appState: AppState;
  authUser?: AuthUser | null;
  onUpdateNilaiSumatif: (
    newList: NilaiSumatif[],
    notif: NotificationLog,
    sumatifConfigByClass?: Record<string, ClassSumatifConfig>
  ) => void;
}

export const InputNilai: React.FC<InputNilaiProps> = ({
  appState,
  authUser,
  onUpdateNilaiSumatif,
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

  // Filter Mata Pelajaran yang diampu saja jika user adalah Guru
  const availableMapelList = isGuru
    ? appState.mapelList.filter((m) => currentGuru?.mapelAmpuanIds?.includes(m.id))
    : appState.mapelList;

  // Filter Kelas yang diampu jika Guru memiliki daftar kelas ampu
  const availableKelasList =
    isGuru && currentGuru?.kelasAmpuanIds && currentGuru.kelasAmpuanIds.length > 0
      ? appState.kelasList.filter(
          (k) =>
            currentGuru.kelasAmpuanIds.includes(k.id) ||
            k.waliKelasId === currentGuru.id
        )
      : appState.kelasList;

  const [selectedKelasId, setSelectedKelasId] = useState<string>(
    availableKelasList[0]?.id || appState.kelasList[0]?.id || ''
  );
  const [selectedMapelId, setSelectedMapelId] = useState<string>(
    availableMapelList[0]?.id || appState.mapelList[0]?.id || ''
  );
  const [selectedAgamaFilter, setSelectedAgamaFilter] = useState<string>('ALL');

  // Sync selectedMapelId if availableMapelList changes or doesn't include current selection
  useEffect(() => {
    if (availableMapelList.length > 0) {
      if (!availableMapelList.some((m) => m.id === selectedMapelId)) {
        setSelectedMapelId(availableMapelList[0].id);
      }
    }
  }, [availableMapelList, selectedMapelId]);

  // Sync selectedKelasId if availableKelasList changes
  useEffect(() => {
    if (availableKelasList.length > 0) {
      if (!availableKelasList.some((k) => k.id === selectedKelasId)) {
        setSelectedKelasId(availableKelasList[0].id);
      }
    }
  }, [availableKelasList, selectedKelasId]);

  // Settings: Banyaknya Nilai Sumatif & Bobot Penilaian per kelas yang diampu guru
  const [classConfigMap, setClassConfigMap] = useState<Record<string, ClassSumatifConfig>>(() => {
    let localMap: Record<string, ClassSumatifConfig> = {};
    try {
      const saved = localStorage.getItem(STORAGE_SUMATIF_CONFIG_KEY);
      if (saved) localMap = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved sumatif config map', e);
    }
    return {
      ...(appState.sumatifConfigByClass || {}),
      ...localMap,
    };
  });

  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyTargetKelasIds, setCopyTargetKelasIds] = useState<string[]>([]);
  const [copySuccessNotice, setCopySuccessNotice] = useState<string | null>(null);

  const activeTA = appState.tahunAjaranList.find(
    (t) => t.id === appState.activeTahunAjaranId
  ) || appState.tahunAjaranList[0];

  // Active composite key and active config for selected class and mapel
  const currentConfigKey = useMemo(
    () => getSumatifConfigKey(selectedKelasId, selectedMapelId),
    [selectedKelasId, selectedMapelId]
  );

  const currentConfig = useMemo(() => {
    return getSumatifConfigForClass(
      selectedKelasId,
      selectedMapelId,
      classConfigMap,
      appState.nilaiSumatifList,
      activeTA
    );
  }, [selectedKelasId, selectedMapelId, classConfigMap, appState.nilaiSumatifList, activeTA]);

  const jumlahSumatif = currentConfig.jumlahSumatif;
  const bobotS = currentConfig.bobotS;
  const bobotSTS = currentConfig.bobotSTS;
  const bobotSAS = currentConfig.bobotSAS;
  const totalBobot = (bobotS || 0) + (bobotSTS || 0) + (bobotSAS || 0) || 1;

  // Function to update config for the currently active class and mapel
  const updateCurrentClassConfig = (partial: Partial<ClassSumatifConfig>) => {
    const updated: ClassSumatifConfig = {
      ...currentConfig,
      ...partial,
    };

    const newMap: Record<string, ClassSumatifConfig> = {
      ...classConfigMap,
      [currentConfigKey]: updated,
      [selectedKelasId]: updated,
    };

    setClassConfigMap(newMap);
    try {
      localStorage.setItem(STORAGE_SUMATIF_CONFIG_KEY, JSON.stringify(newMap));
    } catch (e) {
      console.error('Failed to save sumatif config to storage', e);
    }
    return updated;
  };

  // Filter students for selected class
  const studentsInClass = useMemo(
    () => appState.siswaList.filter((s) => s.kelasId === selectedKelasId),
    [appState.siswaList, selectedKelasId]
  );

  const selectedMapel = appState.mapelList.find((m) => m.id === selectedMapelId);
  const selectedKelas = appState.kelasList.find((k) => k.id === selectedKelasId);

  // Perhitungan statistik agama di kelas terpilih
  const agamaStats = useMemo(() => {
    const counts: Record<string, number> = {};
    studentsInClass.forEach((s) => {
      const ag = (s.agama || 'Islam').trim();
      counts[ag] = (counts[ag] || 0) + 1;
    });
    return counts;
  }, [studentsInClass]);

  const distinctAgamas = Object.keys(agamaStats);
  const hasMultipleAgama = distinctAgamas.length > 1;

  // Cek apakah mata pelajaran adalah mata pelajaran agama
  const isMapelAgama = Boolean(
    selectedMapel &&
      (selectedMapel.namaMapel.toLowerCase().includes('agama') ||
        selectedMapel.namaMapel.toLowerCase().includes('budi pekerti') ||
        selectedMapel.kodeMapel.toLowerCase() === 'pai' ||
        selectedMapel.kodeMapel.toLowerCase() === 'pak')
  );

  // Siswa yang ditampilkan setelah difilter agama
  const displayedStudents = useMemo(() => {
    if (selectedAgamaFilter === 'ALL') return studentsInClass;
    return studentsInClass.filter(
      (s) => (s.agama || 'Islam').trim().toLowerCase() === selectedAgamaFilter.toLowerCase()
    );
  }, [studentsInClass, selectedAgamaFilter]);

  // Local grid values state and cache across classes
  const [gridData, setGridData] = useState<
    Record<
      string,
      {
        tps: number[];
        sts: number;
        sas: number;
      }
    >
  >({});

  const [gridCacheByClass, setGridCacheByClass] = useState<
    Record<string, Record<string, { tps: number[]; sts: number; sas: number }>>
  >({});

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState(false);

  // Sync grid when class, mapel, or activeTA changes, honoring this class's sumatif count
  useEffect(() => {
    const cached = gridCacheByClass[currentConfigKey];
    if (cached && Object.keys(cached).length > 0) {
      const normalized: Record<string, { tps: number[]; sts: number; sas: number }> = {};
      studentsInClass.forEach((s) => {
        const item = cached[s.id] || {
          tps: Array(currentConfig.jumlahSumatif).fill(80),
          sts: 80,
          sas: 84,
        };
        let tps = [...item.tps];
        while (tps.length < currentConfig.jumlahSumatif) tps.push(80);
        if (tps.length > currentConfig.jumlahSumatif) tps = tps.slice(0, currentConfig.jumlahSumatif);
        normalized[s.id] = { ...item, tps };
      });
      setGridData(normalized);
      setSavedSuccess(false);
      setResetSuccessNotice(false);
      return;
    }

    const newGrid: Record<
      string,
      { tps: number[]; sts: number; sas: number }
    > = {};

    studentsInClass.forEach((s) => {
      const existing = appState.nilaiSumatifList.find(
        (n) =>
          n.siswaId === s.id &&
          n.mapelId === selectedMapelId &&
          n.tahunAjaran === activeTA.tahun &&
          n.semester === activeTA.semester
      );

      let parsedTps: number[] = [];
      if (existing?.tps && Array.isArray(existing.tps) && existing.tps.length > 0) {
        parsedTps = [...existing.tps];
      } else if (existing) {
        parsedTps = [
          existing.tp1 ?? 80,
          existing.tp2 ?? 82,
          existing.tp3 ?? 85,
        ];
        let k = 4;
        while (existing[`tp${k}`] !== undefined) {
          parsedTps.push(existing[`tp${k}`]);
          k++;
        }
      } else {
        parsedTps = [80, 82, 85];
      }

      // Adjust length to match THIS class's sumatif count
      while (parsedTps.length < currentConfig.jumlahSumatif) {
        parsedTps.push(80);
      }
      if (parsedTps.length > currentConfig.jumlahSumatif) {
        parsedTps = parsedTps.slice(0, currentConfig.jumlahSumatif);
      }

      newGrid[s.id] = {
        tps: parsedTps,
        sts: existing?.sts ?? 80,
        sas: existing?.sas ?? 84,
      };
    });

    setGridData(newGrid);
    setSavedSuccess(false);
    setResetSuccessNotice(false);
  }, [
    selectedKelasId,
    selectedMapelId,
    activeTA.tahun,
    activeTA.semester,
    studentsInClass,
    currentConfig.jumlahSumatif,
    currentConfigKey,
  ]);

  // Adjust tps array lengths when jumlahSumatif changes for THIS class
  const handleJumlahSumatifChange = (newCount: number) => {
    const clamped = Math.min(10, Math.max(1, newCount));
    updateCurrentClassConfig({ jumlahSumatif: clamped });

    setGridData((prevGrid) => {
      const updatedGrid = { ...prevGrid };
      Object.keys(updatedGrid).forEach((siswaId) => {
        const item = updatedGrid[siswaId];
        let newTps = [...(item.tps || [])];
        while (newTps.length < clamped) {
          newTps.push(80);
        }
        if (newTps.length > clamped) {
          newTps = newTps.slice(0, clamped);
        }
        updatedGrid[siswaId] = {
          ...item,
          tps: newTps,
        };
      });

      setGridCacheByClass((prevCache) => ({
        ...prevCache,
        [currentConfigKey]: updatedGrid,
      }));

      return updatedGrid;
    });

    setSavedSuccess(false);
    setResetSuccessNotice(false);
  };

  // Adjust weights for THIS class
  const handleBobotChange = (
    field: 'bobotS' | 'bobotSTS' | 'bobotSAS',
    value: number
  ) => {
    const safeVal = Math.max(0, Math.min(100, value));
    updateCurrentClassConfig({ [field]: safeVal });
    setSavedSuccess(false);
    setResetSuccessNotice(false);
  };

  const handleScoreChange = (
    siswaId: string,
    field: 'sumatif' | 'sts' | 'sas',
    indexOrVal: number,
    valStr?: string
  ) => {
    setGridData((prev) => {
      const item = prev[siswaId] || {
        tps: Array(jumlahSumatif).fill(0),
        sts: 0,
        sas: 0,
      };

      let updatedItem = { ...item };

      if (field === 'sumatif') {
        const sIndex = indexOrVal;
        const num = Math.min(100, Math.max(0, parseInt(valStr || '0') || 0));
        const updatedTps = [...item.tps];
        updatedTps[sIndex] = num;
        updatedItem.tps = updatedTps;
      } else {
        const num = Math.min(100, Math.max(0, indexOrVal || 0));
        updatedItem[field] = num;
      }

      const newGrid = {
        ...prev,
        [siswaId]: updatedItem,
      };

      setGridCacheByClass((prevCache) => ({
        ...prevCache,
        [currentConfigKey]: newGrid,
      }));

      return newGrid;
    });
    setSavedSuccess(false);
    setResetSuccessNotice(false);
  };

  // Reset all student scores in current class and mapel to 0
  const handleResetAllToZero = () => {
    const resetGrid: Record<
      string,
      { tps: number[]; sts: number; sas: number }
    > = {};

    studentsInClass.forEach((s) => {
      resetGrid[s.id] = {
        tps: Array(jumlahSumatif).fill(0),
        sts: 0,
        sas: 0,
      };
    });

    setGridData(resetGrid);
    setGridCacheByClass((prevCache) => ({
      ...prevCache,
      [currentConfigKey]: resetGrid,
    }));
    setShowResetModal(false);
    setSavedSuccess(false);
    setResetSuccessNotice(true);
  };

  // Helper calculations: dua digit di belakang koma (2 decimals)
  const calculateRerataS = (tps: number[]): string => {
    if (!tps || tps.length === 0) return '0.00';
    const sum = tps.reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    return (sum / tps.length).toFixed(2);
  };

  const calculateNA = (tps: number[], sts: number, sas: number): string => {
    const sumS = tps && tps.length > 0 ? tps.reduce((acc, curr) => acc + (Number(curr) || 0), 0) : 0;
    const rerataS = tps && tps.length > 0 ? sumS / tps.length : 0;
    const bS = Math.max(0, bobotS || 0);
    const bSTS = Math.max(0, bobotSTS || 0);
    const bSAS = Math.max(0, bobotSAS || 0);
    const totalB = bS + bSTS + bSAS || 1;

    const na = (rerataS * bS + (Number(sts) || 0) * bSTS + (Number(sas) || 0) * bSAS) / totalB;
    return na.toFixed(2);
  };

  const handleSave = () => {
    const updatedList = [...appState.nilaiSumatifList];
    const nowStr = new Date().toLocaleString('id-ID');

    studentsInClass.forEach((s) => {
      const g = gridData[s.id] || {
        tps: Array(jumlahSumatif).fill(0),
        sts: 0,
        sas: 0,
      };
      const naStr = calculateNA(g.tps, g.sts, g.sas);
      const na = parseFloat(naStr);

      const existingIndex = updatedList.findIndex(
        (n) =>
          n.siswaId === s.id &&
          n.mapelId === selectedMapelId &&
          n.tahunAjaran === activeTA.tahun &&
          n.semester === activeTA.semester
      );

      const record: NilaiSumatif = {
        id:
          existingIndex >= 0
            ? updatedList[existingIndex].id
            : 'ns-' + s.id + '-' + selectedMapelId,
        siswaId: s.id,
        mapelId: selectedMapelId,
        kelasId: selectedKelasId,
        tahunAjaran: activeTA.tahun,
        semester: activeTA.semester,
        tps: g.tps,
        tp1: g.tps[0] ?? 0,
        tp2: g.tps[1] ?? 0,
        tp3: g.tps[2] ?? 0,
        sts: g.sts,
        sas: g.sas,
        bobotS,
        bobotSTS,
        bobotSAS,
        jumlahSumatif,
        nilaiAkhir: na,
        catatan: existingIndex >= 0 ? updatedList[existingIndex].catatan || '' : '',
        updatedAt: nowStr,
      };

      if (existingIndex >= 0) {
        updatedList[existingIndex] = record;
      } else {
        updatedList.push(record);
      }
    });

    const notif = createNotification(
      'Pembaruan Nilai Sumatif',
      `Nilai Sumatif Mapel ${selectedMapel?.namaMapel} Kelas ${selectedKelas?.namaKelas} (${studentsInClass.length} siswa, ${jumlahSumatif} Sumatif, Bobot ${bobotS}:${bobotSTS}:${bobotSAS}) berhasil disimpan.`,
      'nilai'
    );

    onUpdateNilaiSumatif(updatedList, notif, classConfigMap);
    setSavedSuccess(true);
    setResetSuccessNotice(false);
  };

  const handleOpenCopyModal = () => {
    const others = availableKelasList.filter((k) => k.id !== selectedKelasId);
    setCopyTargetKelasIds(others.map((k) => k.id));
    setShowCopyModal(true);
  };

  const handleApplyCopyConfig = () => {
    if (copyTargetKelasIds.length === 0) return;

    const newMap = { ...classConfigMap };
    copyTargetKelasIds.forEach((targetId) => {
      const targetKey = getSumatifConfigKey(targetId, selectedMapelId);
      newMap[targetKey] = { ...currentConfig };
      newMap[targetId] = { ...currentConfig };
    });

    setClassConfigMap(newMap);
    try {
      localStorage.setItem(STORAGE_SUMATIF_CONFIG_KEY, JSON.stringify(newMap));
    } catch (e) {
      console.error('Failed to save sumatif config', e);
    }
    onUpdateNilaiSumatif(appState.nilaiSumatifList, undefined, newMap);

    const targetNames = appState.kelasList
      .filter((k) => copyTargetKelasIds.includes(k.id))
      .map((k) => k.namaKelas)
      .join(', ');

    setShowCopyModal(false);
    setCopySuccessNotice(
      `Pengaturan (${jumlahSumatif} Sumatif, Bobot ${bobotS}:${bobotSTS}:${bobotSAS}) berhasil disalin ke: ${targetNames}`
    );
    setTimeout(() => setCopySuccessNotice(null), 6000);
  };

  const handleApplyImportExcel = (
    importedGrid: Record<
      string,
      { tps: number[]; sts: number; sas: number; catatan?: string }
    >,
    importedSumatifCount?: number
  ) => {
    if (importedSumatifCount && importedSumatifCount !== jumlahSumatif) {
      handleJumlahSumatifChange(importedSumatifCount);
    }

    setGridData((prev) => {
      const updated = { ...prev };
      Object.keys(importedGrid).forEach((siswaId) => {
        if (updated[siswaId]) {
          updated[siswaId] = {
            tps: importedGrid[siswaId].tps,
            sts: importedGrid[siswaId].sts,
            sas: importedGrid[siswaId].sas,
          };
        }
      });
      return updated;
    });

    const notif = createNotification(
      'Impor Nilai Excel Berhasil',
      `Data nilai siswa kelas ${selectedKelas?.namaKelas} (${importedSumatifCount || jumlahSumatif} Sumatif) berhasil diimpor dari Excel.`,
      'nilai'
    );
    onUpdateNilaiSumatif([...appState.nilaiSumatifList], notif, classConfigMap);
    setSavedSuccess(true);
    setResetSuccessNotice(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <Calculator className="text-blue-600" size={24} />
            <span>Input Nilai Sumatif Kelas</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Entri nilai Sumatif Lingkup Materi (S1..SN), Sumatif Tengah Semester (STS), dan Sumatif Akhir Semester (SAS).
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-2">
          {/* Tombol Reset Semua Nilai ke 0 */}
          <button
            onClick={() => setShowResetModal(true)}
            className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Reset seluruh nilai S1..SN, STS, dan SAS menjadi nol (0)"
          >
            <RotateCcw size={15} />
            <span>Reset Semua Nilai (0)</span>
          </button>

          {/* Export/Import MS Excel Button */}
          <button
            onClick={() => setShowExcelModal(true)}
            className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-700/20 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <FileSpreadsheet size={16} />
            <span>Export / Import Excel</span>
          </button>

          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center space-x-2 shrink-0 cursor-pointer"
          >
            <Save size={16} />
            <span>Simpan Nilai</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
          <CheckCircle size={18} className="shrink-0 text-emerald-600" />
          <span>Nilai berhasil disimpan & notifikasi terkirim! Seluruh rekapitulasi dan grafik telah diperbarui.</span>
        </div>
      )}

      {resetSuccessNotice && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <RotateCcw size={18} className="shrink-0 text-amber-600" />
            <span>Seluruh nilai Sumatif (S1..S{jumlahSumatif}), STS, dan SAS telah di-reset menjadi 0. Klik tombol <strong>Simpan Nilai</strong> untuk menyimpan ke database.</span>
          </div>
          <button
            onClick={() => setResetSuccessNotice(false)}
            className="text-amber-700 hover:text-amber-900 p-1 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {copySuccessNotice && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl text-purple-900 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle size={18} className="shrink-0 text-purple-600" />
            <span>{copySuccessNotice}</span>
          </div>
          <button
            onClick={() => setCopySuccessNotice(null)}
            className="text-purple-700 hover:text-purple-900 p-1 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Role and Subject Ampuan Indicator */}
      {isGuru && currentGuru && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-4 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 border border-blue-700/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/15">
              <UserCheck size={22} className="text-blue-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-extrabold text-white">{currentGuru.nama}</span>
                <span className="text-[10px] bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-400/30 font-medium">
                  NIP: {currentGuru.nip || '-'}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                <span className="font-semibold text-white">Mata Pelajaran Ampuan: </span>
                {availableMapelList.length > 0
                  ? availableMapelList.map((m) => `${m.namaMapel} (${m.kodeMapel})`).join(', ')
                  : 'Belum ada mapel ampu terdaftar'}
              </p>
            </div>
          </div>
          <div className="text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 text-blue-100 flex items-center space-x-1.5 self-start md:self-auto">
            <BookOpen size={14} className="text-emerald-300" />
            <span>Mode Input & Ekspor/Impor Terbatas Mapel Ampuan</span>
          </div>
        </div>
      )}

      {isGuru && availableMapelList.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-start space-x-3">
          <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Belum Ada Mata Pelajaran yang Diampu</span>
            <p className="mt-1 text-slate-600">
              Akun Anda belum dikaitkan dengan mata pelajaran ampu. Silakan hubungi Administrator sekolah untuk menambahkan mata pelajaran ampu pada menu <strong>Manajemen Data Guru</strong> agar Anda dapat mengentri dan mengimpor nilai.
            </p>
          </div>
        </div>
      )}

        {/* Selectors Bar */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
        {/* Quick Class Switcher Tabs (Differentiating Sumatif Count & Bobot per Class) */}
        {availableKelasList.length > 1 && (
          <div className="space-y-1.5 pb-2 border-b border-slate-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
              <span className="font-extrabold text-slate-700 flex items-center space-x-1.5">
                <Layers size={15} className="text-blue-600" />
                <span>Rombel Kelas yang Diampu:</span>
              </span>
              <span className="text-[11px] text-slate-500">
                Setiap kelas memiliki pengaturan banyaknya nilai sumatif & bobot mandiri
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {availableKelasList.map((k) => {
                const isCurrent = k.id === selectedKelasId;
                const cfg = getSumatifConfigForClass(
                  k.id,
                  selectedMapelId,
                  classConfigMap,
                  appState.nilaiSumatifList,
                  activeTA
                );
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => {
                      setSelectedKelasId(k.id);
                      setSelectedAgamaFilter('ALL');
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center space-x-2.5 ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20 ring-2 ring-blue-300 ring-offset-1'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-extrabold">{k.namaKelas}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                        isCurrent
                          ? 'bg-blue-700/80 text-blue-100 border border-blue-400/30'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {cfg.jumlahSumatif} TP • {cfg.bobotS}:{cfg.bobotSTS}:{cfg.bobotSAS}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Rombel Kelas</label>
            <select
              value={selectedKelasId}
              onChange={(e) => {
                setSelectedKelasId(e.target.value);
                setSelectedAgamaFilter('ALL');
              }}
              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden"
            >
              {availableKelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.namaKelas} (Wali: {k.waliKelasNama})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih Mata Pelajaran {isGuru && <span className="text-blue-600 font-normal">(Ampuan Anda)</span>}
            </label>
            <select
              value={selectedMapelId}
              onChange={(e) => setSelectedMapelId(e.target.value)}
              disabled={availableMapelList.length === 0}
              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
            >
              {availableMapelList.length === 0 ? (
                <option value="">-- Tidak ada mapel ampu --</option>
              ) : (
                availableMapelList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.namaMapel} ({m.kodeMapel})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tahun & Semester</label>
            <div className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-blue-600 flex items-center justify-between">
              <span>
                {activeTA.tahun} - Semester {activeTA.semester}
              </span>
              <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-md font-extrabold">
                {selectedKelas?.kodeKelas}
              </span>
            </div>
          </div>
        </div>

        {/* Keberagaman Agama & Filter Agama Siswa */}
        {hasMultipleAgama && (
          <div className="p-3.5 bg-gradient-to-r from-sky-50 via-indigo-50 to-emerald-50 border border-sky-200 rounded-2xl space-y-2.5">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-xs text-sky-950">
                <Info size={16} className="text-sky-600 shrink-0" />
                <span className="font-extrabold text-sky-900">
                  Komposisi Agama Kelas {selectedKelas?.namaKelas} ({studentsInClass.length} Siswa):
                </span>
              </div>
              {isMapelAgama && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-md">
                  Mapel Pendidikan Agama
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-bold text-slate-700 mr-1 flex items-center space-x-1">
                <Filter size={13} className="text-blue-600" />
                <span>Filter Tampilan:</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedAgamaFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  selectedAgamaFilter === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Semua Siswa ({studentsInClass.length})
              </button>

              {distinctAgamas.map((ag) => {
                const badge = getAgamaBadge(ag);
                const isSelected = selectedAgamaFilter.toLowerCase() === ag.toLowerCase();
                return (
                  <button
                    key={ag}
                    type="button"
                    onClick={() => setSelectedAgamaFilter(ag)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : `${badge.bg} hover:opacity-90`
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : badge.dot}`} />
                    <span>
                      {ag} ({agamaStats[ag]})
                    </span>
                  </button>
                );
              })}
            </div>

            {isMapelAgama && (
              <p className="text-[11px] text-sky-800 font-medium">
                💡 <em>Catatan Guru Agama:</em> Anda dapat memilih filter agama di atas untuk mengisi nilai khusus bagi siswa yang mengambil mata pelajaran agama yang Anda ampu tanpa terganggu data siswa beragama lain.
              </p>
            )}
          </div>
        )}

        {/* Pengaturan Banyaknya Nilai Sumatif & Pengaturan Bobot (DIBEDAKAN PER KELAS) */}
        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Banyaknya Nilai Sumatif */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5">
                <ListOrdered size={16} className="text-blue-600" />
                <span>Banyaknya Nilai Sumatif Kelas {selectedKelas?.namaKelas} (LM/TP)</span>
              </span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                {jumlahSumatif} Kolom ({selectedKelas?.namaKelas})
              </span>
            </div>

            <div className="flex items-center space-x-3 flex-wrap gap-2">
              <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleJumlahSumatifChange(jumlahSumatif - 1)}
                  disabled={jumlahSumatif <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Kurangi jumlah sumatif"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={jumlahSumatif}
                  onChange={(e) => handleJumlahSumatifChange(parseInt(e.target.value) || 1)}
                  className="w-14 py-1 font-extrabold text-center text-xs focus:outline-hidden bg-transparent"
                />
                <button
                  type="button"
                  onClick={() => handleJumlahSumatifChange(jumlahSumatif + 1)}
                  disabled={jumlahSumatif >= 10}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white text-slate-700 border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  title="Tambah jumlah sumatif"
                >
                  +
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center space-x-1">
                {[3, 4, 5, 6].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleJumlahSumatifChange(cnt)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      jumlahSumatif === cnt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cnt} TP
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Jumlah lingkup materi / TP yang dinilai (S1 s.d. S{jumlahSumatif}) tersimpan khusus untuk <strong>Kelas {selectedKelas?.namaKelas}</strong> dan tidak mengubah kelas lainnya.
            </p>
          </div>

          {/* Card 2: Pengaturan Bobot Penilaian */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5">
                <Sliders size={16} className="text-purple-600" />
                <span>Bobot Penilaian Kelas {selectedKelas?.namaKelas} (S : STS : SAS)</span>
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                  Total: {totalBobot}
                </span>
                {availableKelasList.length > 1 && (
                  <button
                    type="button"
                    onClick={handleOpenCopyModal}
                    className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 border border-slate-200 rounded-md transition flex items-center space-x-1 cursor-pointer"
                    title="Salin pengaturan sumatif & bobot ke kelas lain yang diampu"
                  >
                    <Copy size={11} />
                    <span>Salin ke Kelas Lain</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Bobot Rerata S</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bobotS}
                  onChange={(e) => handleBobotChange('bobotS', parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-extrabold text-center text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Bobot STS</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bobotSTS}
                  onChange={(e) => handleBobotChange('bobotSTS', parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-extrabold text-center text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">Bobot SAS</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bobotSAS}
                  onChange={(e) => handleBobotChange('bobotSAS', parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-extrabold text-center text-xs bg-slate-50 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Pembobotan Nilai Akhir (NA) berlaku khusus untuk <strong>Kelas {selectedKelas?.namaKelas}</strong>.
            </p>
          </div>
        </div>

        {/* Formula Hint Box */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-[11px] text-blue-900 font-medium">
          <div className="flex items-center space-x-2">
            <Info size={16} className="text-blue-600 shrink-0" />
            <span>
              <strong>Rumus Nilai Akhir (NA) Kelas {selectedKelas?.namaKelas}:</strong>{' '}
              <code>NA = [ (Rerata S × {bobotS}) + (STS × {bobotSTS}) + (SAS × {bobotSAS}) ] / {totalBobot}</code>{' '}
              <span className="text-slate-500 italic ml-1">(Format: 2 digit desimal di belakang koma)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Spreadsheet Input Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-slate-800 uppercase tracking-wider">
              Lembar Input Nilai - {selectedKelas?.namaKelas}
            </span>
            <span className="text-[11px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
              Menampilkan {displayedStudents.length} dari {studentsInClass.length} Siswa
            </span>
            {selectedAgamaFilter !== 'ALL' && (
              <span className="text-[11px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                Filter: Agama {selectedAgamaFilter}
              </span>
            )}
          </div>
          <span className="text-slate-600 font-bold">
            Rerata Sumatif (S) + STS + SAS (2 Desimal)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 w-10 text-center">No</th>
                <th className="p-3 min-w-[180px]">Nama Siswa</th>
                <th className="p-3 w-24 text-center">NISN</th>
                <th className="p-3 w-12 text-center">L/P</th>
                <th className="p-3 w-28 text-center">Agama</th>
                {/* Dynamic Sumatif Columns */}
                {Array.from({ length: jumlahSumatif }, (_, i) => (
                  <th key={i} className="p-3 w-16 text-center">
                    S{i + 1}
                  </th>
                ))}
                <th className="p-3 w-24 text-center bg-blue-50/80 text-blue-900 border-x border-slate-200">
                  Rerata S
                </th>
                <th className="p-3 w-20 text-center bg-indigo-50/80 text-indigo-900">
                  STS
                </th>
                <th className="p-3 w-20 text-center bg-purple-50/80 text-purple-900">
                  SAS
                </th>
                <th className="p-3 w-28 text-center bg-slate-200 text-slate-900 font-black">
                  Nilai Akhir (NA)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9 + jumlahSumatif} className="p-8 text-center text-slate-400">
                    {studentsInClass.length === 0
                      ? 'Tidak ada siswa terdaftar di kelas ini. Silakan tambah siswa di menu Data Siswa.'
                      : `Tidak ada siswa dengan agama ${selectedAgamaFilter} di kelas ini.`}
                  </td>
                </tr>
              ) : (
                displayedStudents.map((s, idx) => {
                  const item = gridData[s.id] || {
                    tps: Array(jumlahSumatif).fill(0),
                    sts: 0,
                    sas: 0,
                  };

                  const rerataS = calculateRerataS(item.tps);
                  const na = calculateNA(item.tps, item.sts, item.sas);
                  const badgeAgama = getAgamaBadge(s.agama);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{s.nama}</td>
                      <td className="p-3 text-center font-mono text-slate-500 text-[11px]">
                        {s.nisn}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-600 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md ${
                            s.jenisKelamin === 'L'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-pink-50 text-pink-700 border border-pink-200'
                          }`}
                        >
                          {s.jenisKelamin || 'L'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center space-x-1 ${badgeAgama.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badgeAgama.dot}`} />
                          <span>{s.agama || 'Islam'}</span>
                        </span>
                      </td>

                      {/* Dynamic S1..SN Inputs */}
                      {Array.from({ length: jumlahSumatif }, (_, sIdx) => (
                        <td key={sIdx} className="p-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={item.tps[sIdx] ?? 0}
                            onChange={(e) =>
                              handleScoreChange(s.id, 'sumatif', sIdx, e.target.value)
                            }
                            className="w-14 text-center font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg py-1 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:outline-hidden"
                          />
                        </td>
                      ))}

                      {/* Rerata S (2 Desimal) */}
                      <td className="p-2 text-center bg-blue-50/30 border-x border-slate-200 font-mono font-black text-blue-900 text-sm">
                        {rerataS}
                      </td>

                      {/* STS */}
                      <td className="p-2 text-center bg-indigo-50/30">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.sts}
                          onChange={(e) =>
                            handleScoreChange(s.id, 'sts', parseInt(e.target.value) || 0)
                          }
                          className="w-14 text-center font-extrabold text-indigo-700 bg-white border border-indigo-200 rounded-lg py-1 focus:ring-2 focus:ring-indigo-500/30 focus:outline-hidden"
                        />
                      </td>

                      {/* SAS */}
                      <td className="p-2 text-center bg-purple-50/30">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.sas}
                          onChange={(e) =>
                            handleScoreChange(s.id, 'sas', parseInt(e.target.value) || 0)
                          }
                          className="w-14 text-center font-extrabold text-purple-700 bg-white border border-purple-200 rounded-lg py-1 focus:ring-2 focus:ring-purple-500/30 focus:outline-hidden"
                        />
                      </td>

                      {/* NA (2 Desimal) */}
                      <td className="p-3 text-center font-mono font-black text-sm bg-slate-100 text-slate-900">
                        {na}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Nilai Akhir (NA) dan Rerata Sumatif dihitung otomatis dalam format <strong>2 digit desimal</strong> di belakang koma.
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowResetModal(true)}
              className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>Reset ke 0</span>
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all flex items-center space-x-1.5"
            >
              <Save size={15} />
              <span>Simpan Nilai Kelas {selectedKelas?.kodeKelas}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Reset Nilai ke 0 */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reset Semua Nilai ke 0?</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan mengosongkan lembar nilai aktif</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl text-xs text-slate-700 space-y-2">
              <p>
                Anda akan mengatur seluruh nilai:
              </p>
              <ul className="list-disc pl-5 font-bold text-rose-950 space-y-0.5">
                <li>Sumatif S1 s.d. S{jumlahSumatif} = <strong>0</strong></li>
                <li>Sumatif Tengah Semester (STS) = <strong>0</strong></li>
                <li>Sumatif Akhir Semester (SAS) = <strong>0</strong></li>
              </ul>
              <p className="text-[11px] text-slate-500 pt-1">
                Untuk kelas <strong>{selectedKelas?.namaKelas}</strong> pada mata pelajaran <strong>{selectedMapel?.namaMapel}</strong> ({studentsInClass.length} siswa).
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetAllToZero}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-lg shadow-rose-600/20 transition cursor-pointer flex items-center space-x-1.5"
              >
                <RotateCcw size={15} />
                <span>Ya, Reset Semua ke Nol</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Salin Pengaturan ke Kelas Lain */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Copy size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Salin Pengaturan ke Kelas Lain</h3>
                  <p className="text-xs text-slate-500">Salin jumlah sumatif & bobot ke kelas ampu pilihan</p>
                </div>
              </div>
              <button
                onClick={() => setShowCopyModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl text-xs text-purple-950 space-y-1">
              <span className="font-extrabold block text-purple-900">Konfigurasi Sumber ({selectedKelas?.namaKelas}):</span>
              <div className="font-mono text-[11px] text-purple-800 space-y-0.5">
                <div>• Banyaknya Nilai Sumatif: <strong>{jumlahSumatif} TP/LM</strong></div>
                <div>• Bobot Penilaian (S : STS : SAS): <strong>{bobotS} : {bobotSTS} : {bobotSAS}</strong> (Total: {totalBobot})</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">Pilih Kelas Tujuan:</label>
                <button
                  type="button"
                  onClick={() => {
                    const allOtherIds = availableKelasList
                      .filter((k) => k.id !== selectedKelasId)
                      .map((k) => k.id);
                    setCopyTargetKelasIds(
                      copyTargetKelasIds.length === allOtherIds.length ? [] : allOtherIds
                    );
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                >
                  {copyTargetKelasIds.length === availableKelasList.length - 1
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {availableKelasList
                  .filter((k) => k.id !== selectedKelasId)
                  .map((k) => {
                    const isChecked = copyTargetKelasIds.includes(k.id);
                    const cfg = getSumatifConfigForClass(
                      k.id,
                      selectedMapelId,
                      classConfigMap,
                      appState.nilaiSumatifList,
                      activeTA
                    );
                    return (
                      <label
                        key={k.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-xs ${
                          isChecked
                            ? 'bg-purple-50/70 border-purple-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCopyTargetKelasIds([...copyTargetKelasIds, k.id]);
                              } else {
                                setCopyTargetKelasIds(copyTargetKelasIds.filter((id) => id !== k.id));
                              }
                            }}
                            className="rounded-md text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                          />
                          <div>
                            <span className="font-extrabold text-slate-800">{k.namaKelas}</span>
                            <span className="text-[11px] text-slate-400 block">Wali: {k.waliKelasNama}</span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          Saat ini: {cfg.jumlahSumatif} TP | {cfg.bobotS}:{cfg.bobotSTS}:{cfg.bobotSAS}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApplyCopyConfig}
                disabled={copyTargetKelasIds.length === 0}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-lg shadow-purple-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Check size={15} />
                <span>Salin ke {copyTargetKelasIds.length} Kelas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Export/Import Modal */}
      {showExcelModal && (
        <ExcelNilaiModal
          appState={appState}
          authUser={authUser}
          allowedMapelIds={availableMapelList.map((m) => m.id)}
          currentGuru={currentGuru}
          selectedKelasId={selectedKelasId}
          selectedMapelId={selectedMapelId}
          jumlahSumatif={jumlahSumatif}
          bobotS={bobotS}
          bobotSTS={bobotSTS}
          bobotSAS={bobotSAS}
          currentGridData={gridData}
          initialAgamaFilter={selectedAgamaFilter}
          onClose={() => setShowExcelModal(false)}
          onApplyImport={handleApplyImportExcel}
        />
      )}
    </div>
  );
};
