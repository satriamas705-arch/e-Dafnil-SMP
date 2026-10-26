import { AppState, Guru, Kelas, Mapel, Siswa, NilaiSumatif, NilaiKelas9, PengaturanSekolah, TahunAjaranConfig, UserAccount } from '../types';

/**
 * Utility for UTF-8 safe Base64 encoding/decoding
 */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Escape single quotes and backslashes for SQL literals
 */
function escapeSqlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * Convert value into SQL literal (NULL, number, or 'string')
 */
function sqlVal(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    return `'${escapeSqlString(JSON.stringify(val))}'`;
  }
  return `'${escapeSqlString(String(val))}'`;
}

/**
 * Generate a complete, valid SQL dump (.sql) from AppState
 */
export function generateSqlDump(appState: AppState): string {
  const timestamp = new Date().toISOString();
  const dateFormatted = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const payloadJson = JSON.stringify(appState);
  const payloadBase64 = utf8ToBase64(payloadJson);

  const lines: string[] = [];

  // SQL Header
  lines.push('-- =================================================================');
  lines.push('-- SISTEM PENILAIAN SISWA (SIPENIS) - SMP NEGERI 2 KEMRANJEN');
  lines.push('-- DATABASE BACKUP FILE (.SQL)');
  lines.push(`-- Tanggal Backup  : ${dateFormatted}`);
  lines.push(`-- Timestamp       : ${timestamp}`);
  lines.push(`-- Sekolah         : ${appState.sekolah?.namaSekolah || 'SMPN 2 Kemranjen'}`);
  lines.push(`-- NPSN            : ${appState.sekolah?.npsn || '-'}`);
  lines.push(`-- Tahun Ajaran    : ${appState.activeTahunAjaranId || '-'}`);
  lines.push(`-- Total Siswa     : ${appState.siswaList?.length || 0}`);
  lines.push(`-- Total Guru      : ${appState.guruList?.length || 0}`);
  lines.push(`-- Total Kelas     : ${appState.kelasList?.length || 0}`);
  lines.push(`-- Total Mapel     : ${appState.mapelList?.length || 0}`);
  lines.push(`-- Total Nilai Sum : ${appState.nilaiSumatifList?.length || 0}`);
  lines.push(`-- Total Nilai K9  : ${appState.nilaiKelas9List?.length || 0}`);
  lines.push('-- =================================================================');
  lines.push('');
  lines.push('-- [PENTING] Payload terenkode untuk restorasi instan & 100% presisi:');
  lines.push(`-- SIPENIS-SQL-PAYLOAD-START`);
  lines.push(`-- ${payloadBase64}`);
  lines.push(`-- SIPENIS-SQL-PAYLOAD-END`);
  lines.push('');
  lines.push('SET NAMES utf8mb4;');
  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('');

  // 1. Table: pengaturan_sekolah
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: pengaturan_sekolah');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `pengaturan_sekolah`;');
  lines.push('CREATE TABLE `pengaturan_sekolah` (');
  lines.push('  `id` INT AUTO_INCREMENT PRIMARY KEY,');
  lines.push('  `namaSekolah` VARCHAR(255) NOT NULL,');
  lines.push('  `npsn` VARCHAR(50),');
  lines.push('  `nseri` VARCHAR(50),');
  lines.push('  `alamat` TEXT,');
  lines.push('  `desaKelurahan` VARCHAR(100),');
  lines.push('  `kecamatan` VARCHAR(100),');
  lines.push('  `kabupatenKota` VARCHAR(100),');
  lines.push('  `provinsi` VARCHAR(100),');
  lines.push('  `kodePos` VARCHAR(20),');
  lines.push('  `telepon` VARCHAR(50),');
  lines.push('  `email` VARCHAR(100),');
  lines.push('  `website` VARCHAR(150),');
  lines.push('  `namaKepalaSekolah` VARCHAR(150),');
  lines.push('  `nipKepalaSekolah` VARCHAR(50),');
  lines.push('  `tanggalSurat` VARCHAR(50),');
  lines.push('  `sistemHariSekolah` VARCHAR(50),');
  lines.push('  `pemerintahDaerah` VARCHAR(150),');
  lines.push('  `alamatLengkapKop` TEXT,');
  lines.push('  `logoUrl` LONGTEXT,');
  lines.push('  `logoPemdaUrl` LONGTEXT,');
  lines.push('  `kopSekolahUrl` LONGTEXT,');
  lines.push('  `stempelUrl` LONGTEXT,');
  lines.push('  `ttdKepalaSekolahUrl` LONGTEXT,');
  lines.push('  `adminFotoUrl` LONGTEXT');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.sekolah) {
    const s = appState.sekolah;
    lines.push('INSERT INTO `pengaturan_sekolah` (`namaSekolah`, `npsn`, `nseri`, `alamat`, `desaKelurahan`, `kecamatan`, `kabupatenKota`, `provinsi`, `kodePos`, `telepon`, `email`, `website`, `namaKepalaSekolah`, `nipKepalaSekolah`, `tanggalSurat`, `sistemHariSekolah`, `pemerintahDaerah`, `alamatLengkapKop`, `logoUrl`, `logoPemdaUrl`, `kopSekolahUrl`, `stempelUrl`, `ttdKepalaSekolahUrl`, `adminFotoUrl`) VALUES (');
    lines.push(`  ${sqlVal(s.namaSekolah)}, ${sqlVal(s.npsn)}, ${sqlVal(s.nseri)}, ${sqlVal(s.alamat)}, ${sqlVal(s.desaKelurahan)},`);
    lines.push(`  ${sqlVal(s.kecamatan)}, ${sqlVal(s.kabupatenKota)}, ${sqlVal(s.provinsi)}, ${sqlVal(s.kodePos)}, ${sqlVal(s.telepon)},`);
    lines.push(`  ${sqlVal(s.email)}, ${sqlVal(s.website)}, ${sqlVal(s.namaKepalaSekolah)}, ${sqlVal(s.nipKepalaSekolah)}, ${sqlVal(s.tanggalSurat)},`);
    lines.push(`  ${sqlVal(s.sistemHariSekolah)}, ${sqlVal(s.pemerintahDaerah)}, ${sqlVal(s.alamatLengkapKop)},`);
    lines.push(`  ${sqlVal(s.logoUrl)}, ${sqlVal(s.logoPemdaUrl)}, ${sqlVal(s.kopSekolahUrl)}, ${sqlVal(s.stempelUrl)}, ${sqlVal(s.ttdKepalaSekolahUrl)}, ${sqlVal(s.adminFotoUrl)}`);
    lines.push(');');
    lines.push('');
  }

  // 2. Table: tahun_ajaran
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: tahun_ajaran');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `tahun_ajaran`;');
  lines.push('CREATE TABLE `tahun_ajaran` (');
  lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
  lines.push('  `tahun` VARCHAR(20) NOT NULL,');
  lines.push('  `semester` VARCHAR(20) NOT NULL,');
  lines.push('  `isAktif` TINYINT(1) DEFAULT 0,');
  lines.push('  `statusSemester` VARCHAR(20) DEFAULT "Aktif"');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.tahunAjaranList && appState.tahunAjaranList.length > 0) {
    for (const t of appState.tahunAjaranList) {
      lines.push(`INSERT INTO ` + '`tahun_ajaran` (`id`, `tahun`, `semester`, `isAktif`, `statusSemester`) VALUES (' +
        `${sqlVal(t.id)}, ${sqlVal(t.tahun)}, ${sqlVal(t.semester)}, ${sqlVal(t.isAktif)}, ${sqlVal(t.statusSemester)});`
      );
    }
    lines.push('');
  }

  // 3. Table: guru
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: guru');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `guru`;');
  lines.push('CREATE TABLE `guru` (');
  lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
  lines.push('  `nip` VARCHAR(50),');
  lines.push('  `nama` VARCHAR(150) NOT NULL,');
  lines.push('  `jenisKelamin` VARCHAR(5),');
  lines.push('  `email` VARCHAR(100),');
  lines.push('  `noHp` VARCHAR(50),');
  lines.push('  `fotoUrl` LONGTEXT,');
  lines.push('  `mapelAmpuanIds` TEXT,');
  lines.push('  `kelasAmpuanIds` TEXT');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.guruList && appState.guruList.length > 0) {
    for (const g of appState.guruList) {
      lines.push('INSERT INTO `guru` (`id`, `nip`, `nama`, `jenisKelamin`, `email`, `noHp`, `fotoUrl`, `mapelAmpuanIds`, `kelasAmpuanIds`) VALUES (' +
        `${sqlVal(g.id)}, ${sqlVal(g.nip)}, ${sqlVal(g.nama)}, ${sqlVal(g.jenisKelamin)}, ${sqlVal(g.email)}, ${sqlVal(g.noHp)}, ` +
        `${sqlVal(g.fotoUrl)}, ${sqlVal(JSON.stringify(g.mapelAmpuanIds || []))}, ${sqlVal(JSON.stringify(g.kelasAmpuanIds || []))});`
      );
    }
    lines.push('');
  }

  // 4. Table: kelas
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: kelas');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `kelas`;');
  lines.push('CREATE TABLE `kelas` (');
  lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
  lines.push('  `kodeKelas` VARCHAR(20) NOT NULL,');
  lines.push('  `namaKelas` VARCHAR(100) NOT NULL,');
  lines.push('  `tingkat` INT NOT NULL,');
  lines.push('  `waliKelasId` VARCHAR(50),');
  lines.push('  `waliKelasNama` VARCHAR(150),');
  lines.push('  `tahunAjaran` VARCHAR(50)');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.kelasList && appState.kelasList.length > 0) {
    for (const k of appState.kelasList) {
      lines.push('INSERT INTO `kelas` (`id`, `kodeKelas`, `namaKelas`, `tingkat`, `waliKelasId`, `waliKelasNama`, `tahunAjaran`) VALUES (' +
        `${sqlVal(k.id)}, ${sqlVal(k.kodeKelas)}, ${sqlVal(k.namaKelas)}, ${sqlVal(k.tingkat)}, ${sqlVal(k.waliKelasId)}, ${sqlVal(k.waliKelasNama)}, ${sqlVal(k.tahunAjaran)});`
      );
    }
    lines.push('');
  }

  // 5. Table: mapel
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: mapel');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `mapel`;');
  lines.push('CREATE TABLE `mapel` (');
  lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
  lines.push('  `kodeMapel` VARCHAR(20) NOT NULL,');
  lines.push('  `namaMapel` VARCHAR(150) NOT NULL,');
  lines.push('  `urutan` INT,');
  lines.push('  `kelompok` VARCHAR(100),');
  lines.push('  `kkm` INT,');
  lines.push('  `jamPerMinggu` INT');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.mapelList && appState.mapelList.length > 0) {
    for (const m of appState.mapelList) {
      lines.push('INSERT INTO `mapel` (`id`, `kodeMapel`, `namaMapel`, `urutan`, `kelompok`, `kkm`, `jamPerMinggu`) VALUES (' +
        `${sqlVal(m.id)}, ${sqlVal(m.kodeMapel)}, ${sqlVal(m.namaMapel)}, ${sqlVal(m.urutan)}, ${sqlVal(m.kelompok)}, ${sqlVal(m.kkm)}, ${sqlVal(m.jamPerMinggu)});`
      );
    }
    lines.push('');
  }

  // 6. Table: siswa
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: siswa');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `siswa`;');
  lines.push('CREATE TABLE `siswa` (');
  lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
  lines.push('  `nis` VARCHAR(50),');
  lines.push('  `nisn` VARCHAR(50),');
  lines.push('  `nama` VARCHAR(150) NOT NULL,');
  lines.push('  `jenisKelamin` VARCHAR(5),');
  lines.push('  `agama` VARCHAR(50),');
  lines.push('  `kelasId` VARCHAR(50),');
  lines.push('  `kodeKelas` VARCHAR(20),');
  lines.push('  `tempatLahir` VARCHAR(100),');
  lines.push('  `tanggalLahir` VARCHAR(50),');
  lines.push('  `status` VARCHAR(50),');
  lines.push('  `noPesertaUjian` VARCHAR(50),');
  lines.push('  `noIjazah` VARCHAR(50),');
  lines.push('  `tanggalIjazah` VARCHAR(50),');
  lines.push('  `tanggalKelulusan` VARCHAR(50)');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.siswaList && appState.siswaList.length > 0) {
    for (const s of appState.siswaList) {
      lines.push('INSERT INTO `siswa` (`id`, `nis`, `nisn`, `nama`, `jenisKelamin`, `agama`, `kelasId`, `kodeKelas`, `tempatLahir`, `tanggalLahir`, `status`, `noPesertaUjian`, `noIjazah`, `tanggalIjazah`, `tanggalKelulusan`) VALUES (' +
        `${sqlVal(s.id)}, ${sqlVal(s.nis)}, ${sqlVal(s.nisn)}, ${sqlVal(s.nama)}, ${sqlVal(s.jenisKelamin)}, ${sqlVal(s.agama)}, ${sqlVal(s.kelasId)}, ` +
        `${sqlVal(s.kodeKelas)}, ${sqlVal(s.tempatLahir)}, ${sqlVal(s.tanggalLahir)}, ${sqlVal(s.status)}, ${sqlVal(s.noPesertaUjian)}, ${sqlVal(s.noIjazah)}, ${sqlVal(s.tanggalIjazah)}, ${sqlVal(s.tanggalKelulusan)});`
      );
    }
    lines.push('');
  }

  // 7. Table: nilai_sumatif
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: nilai_sumatif');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `nilai_sumatif`;');
  lines.push('CREATE TABLE `nilai_sumatif` (');
  lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
  lines.push('  `siswaId` VARCHAR(50) NOT NULL,');
  lines.push('  `mapelId` VARCHAR(50) NOT NULL,');
  lines.push('  `kelasId` VARCHAR(50) NOT NULL,');
  lines.push('  `tahunAjaran` VARCHAR(50) NOT NULL,');
  lines.push('  `semester` VARCHAR(20) NOT NULL,');
  lines.push('  `tp1` DECIMAL(5,2),');
  lines.push('  `tp2` DECIMAL(5,2),');
  lines.push('  `tp3` DECIMAL(5,2),');
  lines.push('  `tps` TEXT,');
  lines.push('  `sts` DECIMAL(5,2),');
  lines.push('  `sas` DECIMAL(5,2),');
  lines.push('  `bobotS` DECIMAL(5,2),');
  lines.push('  `bobotSTS` DECIMAL(5,2),');
  lines.push('  `bobotSAS` DECIMAL(5,2),');
  lines.push('  `jumlahSumatif` INT,');
  lines.push('  `nilaiAkhir` DECIMAL(5,2),');
  lines.push('  `catatan` TEXT,');
  lines.push('  `updatedAt` VARCHAR(50)');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.nilaiSumatifList && appState.nilaiSumatifList.length > 0) {
    for (const n of appState.nilaiSumatifList) {
      lines.push('INSERT INTO `nilai_sumatif` (`id`, `siswaId`, `mapelId`, `kelasId`, `tahunAjaran`, `semester`, `tp1`, `tp2`, `tp3`, `tps`, `sts`, `sas`, `bobotS`, `bobotSTS`, `bobotSAS`, `jumlahSumatif`, `nilaiAkhir`, `catatan`, `updatedAt`) VALUES (' +
        `${sqlVal(n.id)}, ${sqlVal(n.siswaId)}, ${sqlVal(n.mapelId)}, ${sqlVal(n.kelasId)}, ${sqlVal(n.tahunAjaran)}, ${sqlVal(n.semester)}, ` +
        `${sqlVal(n.tp1)}, ${sqlVal(n.tp2)}, ${sqlVal(n.tp3)}, ${sqlVal(n.tps)}, ${sqlVal(n.sts)}, ${sqlVal(n.sas)}, ${sqlVal(n.bobotS)}, ${sqlVal(n.bobotSTS)}, ` +
        `${sqlVal(n.bobotSAS)}, ${sqlVal(n.jumlahSumatif)}, ${sqlVal(n.nilaiAkhir)}, ${sqlVal(n.catatan)}, ${sqlVal(n.updatedAt)});`
      );
    }
    lines.push('');
  }

  // 8. Table: nilai_kelas9
  lines.push('-- -------------------------------------------------------------');
  lines.push('-- Table: nilai_kelas9');
  lines.push('-- -------------------------------------------------------------');
  lines.push('DROP TABLE IF EXISTS `nilai_kelas9`;');
  lines.push('CREATE TABLE `nilai_kelas9` (');
  lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
  lines.push('  `siswaId` VARCHAR(50) NOT NULL,');
  lines.push('  `tahunAjaran` VARCHAR(50) NOT NULL,');
  lines.push('  `nilaiRaporSem1_5` LONGTEXT,');
  lines.push('  `nilaiSumatifAkhir` LONGTEXT,');
  lines.push('  `nilaiSekolah` LONGTEXT,');
  lines.push('  `k9DetailMapel` LONGTEXT,');
  lines.push('  `rataRataKeseluruhan` DECIMAL(5,2),');
  lines.push('  `statusLulus` VARCHAR(50),');
  lines.push('  `noSuratSKL` VARCHAR(100),');
  lines.push('  `noSuratSKNR` VARCHAR(100),');
  lines.push('  `noSuratTranskrip` VARCHAR(100),');
  lines.push('  `noIjazah` VARCHAR(100),');
  lines.push('  `tanggalIjazah` VARCHAR(50),');
  lines.push('  `tanggalKelulusan` VARCHAR(50),');
  lines.push('  `updatedAt` VARCHAR(50)');
  lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
  lines.push('');

  if (appState.nilaiKelas9List && appState.nilaiKelas9List.length > 0) {
    for (const k of appState.nilaiKelas9List) {
      lines.push('INSERT INTO `nilai_kelas9` (`id`, `siswaId`, `tahunAjaran`, `nilaiRaporSem1_5`, `nilaiSumatifAkhir`, `nilaiSekolah`, `k9DetailMapel`, `rataRataKeseluruhan`, `statusLulus`, `noSuratSKL`, `noSuratSKNR`, `noSuratTranskrip`, `noIjazah`, `tanggalIjazah`, `tanggalKelulusan`, `updatedAt`) VALUES (' +
        `${sqlVal(k.id)}, ${sqlVal(k.siswaId)}, ${sqlVal(k.tahunAjaran)}, ${sqlVal(k.nilaiRaporSem1_5)}, ${sqlVal(k.nilaiSumatifAkhir)}, ` +
        `${sqlVal(k.nilaiSekolah)}, ${sqlVal(k.k9DetailMapel)}, ${sqlVal(k.rataRataKeseluruhan)}, ${sqlVal(k.statusLulus)}, ${sqlVal(k.noSuratSKL)}, ` +
        `${sqlVal(k.noSuratSKNR)}, ${sqlVal(k.noSuratTranskrip)}, ${sqlVal(k.noIjazah)}, ${sqlVal(k.tanggalIjazah)}, ${sqlVal(k.tanggalKelulusan)}, ${sqlVal(k.updatedAt)});`
      );
    }
    lines.push('');
  }

  // 9. Table: user_accounts
  if (appState.userAccounts && appState.userAccounts.length > 0) {
    lines.push('-- -------------------------------------------------------------');
    lines.push('-- Table: user_accounts');
    lines.push('-- -------------------------------------------------------------');
    lines.push('DROP TABLE IF EXISTS `user_accounts`;');
    lines.push('CREATE TABLE `user_accounts` (');
    lines.push('  `id` VARCHAR(50) PRIMARY KEY,');
    lines.push('  `role` VARCHAR(20) NOT NULL,');
    lines.push('  `username` VARCHAR(100) NOT NULL,');
    lines.push('  `nama` VARCHAR(150) NOT NULL,');
    lines.push('  `password` VARCHAR(255) NOT NULL,');
    lines.push('  `guruId` VARCHAR(50),');
    lines.push('  `nip` VARCHAR(50),');
    lines.push('  `fotoUrl` LONGTEXT,');
    lines.push('  `updatedAt` VARCHAR(50)');
    lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
    lines.push('');

    for (const u of appState.userAccounts) {
      lines.push('INSERT INTO `user_accounts` (`id`, `role`, `username`, `nama`, `password`, `guruId`, `nip`, `fotoUrl`, `updatedAt`) VALUES (' +
        `${sqlVal(u.id)}, ${sqlVal(u.role)}, ${sqlVal(u.username)}, ${sqlVal(u.nama)}, ${sqlVal(u.password)}, ${sqlVal(u.guruId)}, ${sqlVal(u.nip)}, ${sqlVal(u.fotoUrl)}, ${sqlVal(u.updatedAt)});`
      );
    }
    lines.push('');
  }

  // 10. Table: sumatif_config
  if (appState.sumatifConfigByClass && Object.keys(appState.sumatifConfigByClass).length > 0) {
    lines.push('-- -------------------------------------------------------------');
    lines.push('-- Table: sumatif_config');
    lines.push('-- -------------------------------------------------------------');
    lines.push('DROP TABLE IF EXISTS `sumatif_config`;');
    lines.push('CREATE TABLE `sumatif_config` (');
    lines.push('  `classKey` VARCHAR(100) PRIMARY KEY,');
    lines.push('  `configJson` TEXT NOT NULL');
    lines.push(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
    lines.push('');

    for (const [key, cfg] of Object.entries(appState.sumatifConfigByClass)) {
      lines.push(`INSERT INTO ` + '`sumatif_config` (`classKey`, `configJson`) VALUES (' +
        `${sqlVal(key)}, ${sqlVal(JSON.stringify(cfg))});`
      );
    }
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  lines.push('');
  lines.push('-- =================================================================');
  lines.push('-- SELESAI EKSPOR BACKUP SQL');
  lines.push('-- =================================================================');

  return lines.join('\n');
}

export interface SqlParseResult {
  success: boolean;
  data?: AppState;
  error?: string;
  stats?: {
    sekolahName: string;
    siswaCount: number;
    guruCount: number;
    kelasCount: number;
    mapelCount: number;
    nilaiSumatifCount: number;
    nilaiKelas9Count: number;
    tahunAjaranCount: number;
    userCount: number;
  };
}

/**
 * Parse an SQL file content back into AppState
 */
export function parseSqlDump(sqlContent: string, currentFallbackState?: AppState): SqlParseResult {
  if (!sqlContent || typeof sqlContent !== 'string') {
    return { success: false, error: 'File SQL kosong atau tidak dapat dibaca.' };
  }

  // Method 1: Check for encoded payload marker
  const payloadStartMarker = '-- SIPENIS-SQL-PAYLOAD-START';
  const payloadEndMarker = '-- SIPENIS-SQL-PAYLOAD-END';

  const startIndex = sqlContent.indexOf(payloadStartMarker);
  const endIndex = sqlContent.indexOf(payloadEndMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    try {
      const payloadSection = sqlContent.substring(
        startIndex + payloadStartMarker.length,
        endIndex
      );
      // Clean up lines and comments
      const base64Str = payloadSection
        .split('\n')
        .map((l) => l.trim().replace(/^--\s*/, ''))
        .join('')
        .trim();

      if (base64Str) {
        const jsonStr = base64ToUtf8(base64Str);
        const parsed: AppState = JSON.parse(jsonStr);

        if (parsed.sekolah && parsed.siswaList && parsed.guruList) {
          return {
            success: true,
            data: parsed,
            stats: {
              sekolahName: parsed.sekolah?.namaSekolah || 'SMPN 2 Kemranjen',
              siswaCount: parsed.siswaList?.length || 0,
              guruCount: parsed.guruList?.length || 0,
              kelasCount: parsed.kelasList?.length || 0,
              mapelCount: parsed.mapelList?.length || 0,
              nilaiSumatifCount: parsed.nilaiSumatifList?.length || 0,
              nilaiKelas9Count: parsed.nilaiKelas9List?.length || 0,
              tahunAjaranCount: parsed.tahunAjaranList?.length || 0,
              userCount: parsed.userAccounts?.length || 0,
            },
          };
        }
      }
    } catch (e) {
      console.warn('Payload marker decoding failed, attempting standard SQL statement parsing...', e);
    }
  }

  // Method 2: Fallback parse standard SQL INSERT INTO statements
  try {
    const defaultState: AppState = currentFallbackState || {
      sekolah: {
        namaSekolah: 'SMP Negeri 2 Kemranjen',
        npsn: '20302061',
        nseri: '-',
        alamat: 'Jl. Raya Kemranjen',
        desaKelurahan: 'Karangsalam',
        kecamatan: 'Kemranjen',
        kabupatenKota: 'Kab. Banyumas',
        provinsi: 'Jawa Tengah',
        kodePos: '53194',
        telepon: '08112627753',
        email: 'smpn2.kemranjen@banyumaskab.go.id',
        website: 'smpn2kemranjen.sch.id',
        namaKepalaSekolah: 'Kepala Sekolah, M.Pd.',
        nipKepalaSekolah: '197001011995011001',
        tanggalSurat: '15 Juni 2026',
      },
      tahunAjaranList: [],
      activeTahunAjaranId: 'ta-2025-2026-genap',
      guruList: [],
      kelasList: [],
      mapelList: [],
      siswaList: [],
      nilaiSumatifList: [],
      nilaiKelas9List: [],
      notifications: [],
      userAccounts: [],
      sumatifConfigByClass: {},
    };

    const restoredState: AppState = {
      ...defaultState,
      guruList: [],
      kelasList: [],
      mapelList: [],
      siswaList: [],
      nilaiSumatifList: [],
      nilaiKelas9List: [],
      tahunAjaranList: [],
      userAccounts: [],
      sumatifConfigByClass: {},
    };

    // Helper to extract values from an SQL VALUES tuple
    const parseValuesTuple = (valTupleStr: string): any[] => {
      const values: any[] = [];
      let current = '';
      let inString = false;
      let escapeNext = false;
      let depth = 0;

      for (let i = 0; i < valTupleStr.length; i++) {
        const char = valTupleStr[i];

        if (escapeNext) {
          current += char;
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === "'") {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '(') depth++;
          else if (char === ')') depth--;
          else if (char === ',' && depth === 0) {
            const raw = current.trim();
            if (raw === 'NULL' || raw === 'null') values.push(null);
            else if (!isNaN(Number(raw)) && raw !== '') values.push(Number(raw));
            else values.push(raw);
            current = '';
            continue;
          }
        }
        current += char;
      }

      if (current.trim().length > 0) {
        const raw = current.trim();
        if (raw === 'NULL' || raw === 'null') values.push(null);
        else if (!isNaN(Number(raw)) && raw !== '') values.push(Number(raw));
        else values.push(raw);
      }

      return values;
    };

    // Regex to match INSERT INTO `table` (`col1`, `col2`, ...) VALUES (...)
    const insertRegex = /INSERT\s+INTO\s+`?([a-zA-Z0-9_]+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*\(([\s\S]*?)\);/gi;
    let match: RegExpExecArray | null;
    let foundAnyTable = false;

    while ((match = insertRegex.exec(sqlContent)) !== null) {
      foundAnyTable = true;
      const tableName = match[1].toLowerCase();
      const colsStr = match[2];
      const valsStr = match[3];

      const cols = colsStr ? colsStr.split(',').map((c) => c.trim().replace(/`/g, '')) : [];
      const vals = parseValuesTuple(valsStr);

      const rowObj: Record<string, any> = {};
      if (cols.length === vals.length) {
        cols.forEach((col, idx) => {
          rowObj[col] = vals[idx];
        });
      }

      switch (tableName) {
        case 'pengaturan_sekolah':
          restoredState.sekolah = {
            ...restoredState.sekolah,
            ...(rowObj as PengaturanSekolah),
          };
          break;
        case 'guru':
          if (rowObj.id && rowObj.nama) {
            if (typeof rowObj.mapelAmpuanIds === 'string') {
              try { rowObj.mapelAmpuanIds = JSON.parse(rowObj.mapelAmpuanIds); } catch {}
            }
            if (typeof rowObj.kelasAmpuanIds === 'string') {
              try { rowObj.kelasAmpuanIds = JSON.parse(rowObj.kelasAmpuanIds); } catch {}
            }
            restoredState.guruList.push(rowObj as Guru);
          }
          break;
        case 'kelas':
          if (rowObj.id && rowObj.namaKelas) {
            restoredState.kelasList.push(rowObj as Kelas);
          }
          break;
        case 'mapel':
          if (rowObj.id && rowObj.namaMapel) {
            restoredState.mapelList.push(rowObj as Mapel);
          }
          break;
        case 'siswa':
          if (rowObj.id && rowObj.nama) {
            restoredState.siswaList.push(rowObj as Siswa);
          }
          break;
        case 'nilai_sumatif':
          if (rowObj.id && rowObj.siswaId) {
            restoredState.nilaiSumatifList.push(rowObj as NilaiSumatif);
          }
          break;
        case 'nilai_kelas9':
          if (rowObj.id && rowObj.siswaId) {
            ['nilaiRaporSem1_5', 'nilaiSumatifAkhir', 'nilaiSekolah', 'k9DetailMapel'].forEach((f) => {
              if (typeof rowObj[f] === 'string') {
                try { rowObj[f] = JSON.parse(rowObj[f]); } catch {}
              }
            });
            restoredState.nilaiKelas9List.push(rowObj as NilaiKelas9);
          }
          break;
        case 'tahun_ajaran':
          if (rowObj.id && rowObj.tahun) {
            rowObj.isAktif = Boolean(rowObj.isAktif);
            restoredState.tahunAjaranList.push(rowObj as TahunAjaranConfig);
          }
          break;
        case 'user_accounts':
          if (rowObj.id && rowObj.username) {
            restoredState.userAccounts!.push(rowObj as UserAccount);
          }
          break;
        case 'sumatif_config':
          if (rowObj.classKey && rowObj.configJson) {
            try {
              restoredState.sumatifConfigByClass![rowObj.classKey] = JSON.parse(rowObj.configJson);
            } catch {}
          }
          break;
      }
    }

    if (!foundAnyTable && !restoredState.siswaList.length && !restoredState.guruList.length) {
      return {
        success: false,
        error: 'Tidak ditemukan perintah SQL (INSERT INTO) yang sesuai dengan struktur database aplikasi SIPENIS.',
      };
    }

    return {
      success: true,
      data: restoredState,
      stats: {
        sekolahName: restoredState.sekolah?.namaSekolah || 'SMPN 2 Kemranjen',
        siswaCount: restoredState.siswaList.length,
        guruCount: restoredState.guruList.length,
        kelasCount: restoredState.kelasList.length,
        mapelCount: restoredState.mapelList.length,
        nilaiSumatifCount: restoredState.nilaiSumatifList.length,
        nilaiKelas9Count: restoredState.nilaiKelas9List.length,
        tahunAjaranCount: restoredState.tahunAjaranList.length,
        userCount: restoredState.userAccounts?.length || 0,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: `Gagal memproses file SQL: ${err.message || 'Format SQL tidak sesuai'}`,
    };
  }
}
