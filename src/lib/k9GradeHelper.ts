import { K9MapelDetail, NilaiKelas9, Siswa, Kelas, Mapel, AppState } from '../types';

export interface CalculatedScores {
  rerataRapor: number;
  rerataRaporSem1_5: number;
  rerataUS: number;
  nilaiSekolah: number;
}

/**
 * Calculate scores for a single subject based on K9MapelDetail
 */
export function calculateK9MapelScores(
  detail: Partial<K9MapelDetail> | undefined,
  bobotUsTulis = 60,
  bobotUsPraktik = 40,
  bobotRataRapor = 60,
  bobotRataUs = 40
): CalculatedScores {
  if (!detail) {
    return {
      rerataRapor: 0,
      rerataRaporSem1_5: 0,
      rerataUS: 0,
      nilaiSekolah: 0,
    };
  }

  const s1 = Number(detail.s1) || 0;
  const s2 = Number(detail.s2) || 0;
  const s3 = Number(detail.s3) || 0;
  const s4 = Number(detail.s4) || 0;
  const s5 = Number(detail.s5) || 0;
  const s6 = Number(detail.s6) || 0;
  const usTulis = Number(detail.usTulis) || 0;
  const usPraktik = Number(detail.usPraktik) || 0;

  // 6 semesters sum and average
  const sum6 = s1 + s2 + s3 + s4 + s5 + s6;
  const rerataRapor = parseFloat((sum6 / 6).toFixed(2));

  // 5 semesters sum and average (for SKNR)
  const sum5 = s1 + s2 + s3 + s4 + s5;
  const rerataRaporSem1_5 = parseFloat((sum5 / 5).toFixed(2));

  // US weighted average
  const totalBobotUS = (bobotUsTulis || 0) + (bobotUsPraktik || 0) || 1;
  const rerataUS = parseFloat(
    ((usTulis * bobotUsTulis + usPraktik * bobotUsPraktik) / totalBobotUS).toFixed(2)
  );

  // Nilai Sekolah (Akhir)
  const totalBobotNA = (bobotRataRapor || 0) + (bobotRataUs || 0) || 1;
  const nilaiSekolah = parseFloat(
    ((rerataRapor * bobotRataRapor + rerataUS * bobotRataUs) / totalBobotNA).toFixed(2)
  );

  return {
    rerataRapor,
    rerataRaporSem1_5,
    rerataUS,
    nilaiSekolah,
  };
}

/**
 * Format score value with 2 decimal places and Indonesian comma format (e.g. 88,50)
 */
export function formatScoreVal(val: number | undefined | null, emptyPlaceholder = '-'): string {
  if (val === undefined || val === null || isNaN(val) || val <= 0) {
    return emptyPlaceholder;
  }
  return Number(val).toFixed(2).replace('.', ',');
}

/**
 * Check whether a student belongs to Grade 9 (Kelas IX)
 */
export function isGrade9Student(siswa: Siswa, kelasList: Kelas[]): boolean {
  if (!siswa) return false;
  const kObj = kelasList.find((k) => k.id === siswa.kelasId || k.kodeKelas === siswa.kodeKelas);
  if (kObj && (kObj.tingkat === 9 || kObj.kodeKelas.startsWith('9') || kObj.kodeKelas.startsWith('IX') || kObj.namaKelas.includes('9') || kObj.namaKelas.includes('IX'))) {
    return true;
  }
  return (
    siswa.kodeKelas.startsWith('9') ||
    siswa.kodeKelas.startsWith('IX') ||
    siswa.kodeKelas.includes('9')
  );
}

/**
 * Get or build complete NilaiKelas9 record for a student
 */
export function getOrCreateNilaiKelas9(
  existingList: NilaiKelas9[],
  siswaId: string,
  tahunAjaran: string,
  siswaIndex = 1
): NilaiKelas9 {
  const existing = existingList.find((n) => n.siswaId === siswaId);
  if (existing) {
    return {
      ...existing,
      nilaiRaporSem1_5: existing.nilaiRaporSem1_5 || {},
      nilaiSumatifAkhir: existing.nilaiSumatifAkhir || {},
      nilaiSekolah: existing.nilaiSekolah || {},
      k9DetailMapel: existing.k9DetailMapel || {},
    };
  }

  const padIdx = String(siswaIndex).padStart(3, '0');
  return {
    id: `nk9-${siswaId}`,
    siswaId,
    tahunAjaran,
    nilaiRaporSem1_5: {},
    nilaiSumatifAkhir: {},
    nilaiSekolah: {},
    k9DetailMapel: {},
    rataRataKeseluruhan: 0,
    statusLulus: 'LULUS',
    noSuratSKL: `421.3/SKL-${padIdx}/SMPN2/VI/2026`,
    noSuratSKNR: `421.3/SKNR-${padIdx}/SMPN2/VI/2026`,
    noSuratTranskrip: `421.3/TR-${padIdx}/SMPN2/VI/2026`,
    updatedAt: new Date().toLocaleString('id-ID'),
  };
}

/**
 * Get subject score from any available tier with fallback
 */
export function getMapelFinalScore(
  gradeRecord: NilaiKelas9 | undefined,
  mapelId: string
): number {
  if (!gradeRecord) return 0;

  // 1. Direct nilaiSekolah
  if (gradeRecord.nilaiSekolah?.[mapelId] && gradeRecord.nilaiSekolah[mapelId] > 0) {
    return gradeRecord.nilaiSekolah[mapelId];
  }

  // 2. From k9DetailMapel
  if (gradeRecord.k9DetailMapel?.[mapelId]) {
    const calc = calculateK9MapelScores(gradeRecord.k9DetailMapel[mapelId]);
    if (calc.nilaiSekolah > 0) return calc.nilaiSekolah;
    if (calc.rerataRapor > 0) return calc.rerataRapor;
  }

  // 3. From nilaiSumatifAkhir
  if (gradeRecord.nilaiSumatifAkhir?.[mapelId] && gradeRecord.nilaiSumatifAkhir[mapelId] > 0) {
    return gradeRecord.nilaiSumatifAkhir[mapelId];
  }

  // 4. From nilaiRaporSem1_5
  if (gradeRecord.nilaiRaporSem1_5?.[mapelId] && gradeRecord.nilaiRaporSem1_5[mapelId] > 0) {
    return gradeRecord.nilaiRaporSem1_5[mapelId];
  }

  return 0;
}
