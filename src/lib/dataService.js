import { supabase } from "./supabase";
import rtGeoJson from "../data/rtGeoJson";

// ============================================================
// Data Service Layer
// ============================================================
// Handles fetching and inserting mapping data from Supabase.
//
// Skema Supabase (lihat supabase-compat-mapping.sql):
//   - public.mapping_rt_boundaries          -> batas RT (tetap satu tabel)
//   - public.case_<slug>                    -> 1 tabel per kasus
//   - public.case_<slug>_view                -> 1 view per kasus (latest per RT,
//                                               dipakai untuk kebutuhan lain / dashboard,
//                                               BUKAN untuk fetch by-period di sini karena
//                                               view tidak difilter per periode tertentu)
// ============================================================

const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url && url !== "YOUR_SUPABASE_URL" && url !== "https://your-project.supabase.co";
};

const DEFAULT_DISEASES = [
  { slug: "stunting", name: "Stunting", display_name: "Stunting" },
  { slug: "pneumonia", name: "Pneumonia", display_name: "Pneumonia" },
  { slug: "tbc", name: "TBC", display_name: "TBC" },
  { slug: "hipertensi", name: "Hipertensi", display_name: "Hipertensi" },
  { slug: "dm", name: "DM", display_name: "DM" },
  { slug: "dbd", name: "DBD", display_name: "DBD" },
  { slug: "diare", name: "Diare", display_name: "Diare" },
  { slug: "pasien_immobilisasi", name: "Pasien Immobilisasi", display_name: "Pasien Immobilisasi" },
  { slug: "ibu_hamil", name: "Ibu Hamil", display_name: "Ibu Hamil" },
];

const DISEASE_SLUGS = new Set(DEFAULT_DISEASES.map((d) => d.slug));

const normalizeRTNumber = (value) => String(value).trim().padStart(2, "0");

// Gunakan hanya tabel legacy `rt_boundaries` untuk data batas RT.
const TABLE_CANDIDATES = {
  boundaries: ["rt_boundaries"],
};

const tableExistenceCache = new Map();

const SUPABASE_QUERY_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const isMissingTableError = (error) => {
  if (!error) return false;
  const message = String(error.message || error.details || "").toLowerCase();
  const code = String(error.code || "");
  return (
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("could not find") ||
    code === "42P01"
  );
};

async function tableExists(table) {
  const cacheKey = `${table}`;
  const cached = tableExistenceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SUPABASE_QUERY_CACHE_TTL) {
    return cached.exists;
  }

  const { error } = await supabase.from(table).select("id").limit(1);
  const exists = !error || !isMissingTableError(error);

  tableExistenceCache.set(cacheKey, { exists, timestamp: Date.now() });

  if (!exists && !isMissingTableError(error)) {
    console.warn(`[DataService] Table existence check for "${table}" failed:`, error.message || error.details);
  }

  return exists;
}

async function resolveTable(candidates = []) {
  for (const table of candidates) {
    if (await tableExists(table)) {
      return table;
    }
  }
  return null;
}

/**
 * Nama tabel kasus per penyakit, sesuai supabase-compat-mapping.sql:
 * case_stunting, case_pneumonia, case_tbc, case_hipertensi, case_dm,
 * case_dbd, case_diare, case_pasien_immobilisasi, case_ibu_hamil.
 * Slug yang tidak dikenal di-fallback ke "stunting".
 */
function getCaseTableName(diseaseSlug) {
  const slug = DISEASE_SLUGS.has(diseaseSlug) ? diseaseSlug : "stunting";
  return `case_${slug}`;
}

const toGeometry = (geometry) => (
  typeof geometry === "string" ? JSON.parse(geometry) : geometry
);

const toGeoJson = (boundaries = [], cases = [], fallbackKelurahan, diseaseSlug = "stunting") => {
  const casesByRT = new Map(
    cases.map((row) => [normalizeRTNumber(row.rt_number), row])
  );

  return {
    type: "FeatureCollection",
    features: boundaries.map((boundary) => {
      const rtNumber = normalizeRTNumber(boundary.rt_number);
      const caseData = casesByRT.get(rtNumber);
      const caseCount = Number(caseData?.case_count ?? 0);

      return {
        type: "Feature",
        properties: {
          rt_number: boundary.rt_number,
          case_count: caseCount,
          stunting_count: caseCount,
          kelurahan: boundary.kelurahan || fallbackKelurahan || "Gunung Sari Ulu",
          period: caseData?.period,
          updated_at: caseData?.updated_at,
          notes: caseData?.notes,
          disease_slug: diseaseSlug,
        },
        geometry: toGeometry(boundary.geometry),
      };
    }),
  };
};

/**
 * Daftar jenis kasus untuk dropdown. Sudah tidak ada tabel
 * mapping_disease_definitions di skema baru, jadi ini statis saja.
 */
export async function fetchDiseaseDefinitions() {
  return DEFAULT_DISEASES;
}

/**
 * Fetch RT data for the selected disease and period.
 */
export async function fetchRTData(kelurahan, period, diseaseSlug = "stunting") {
  const activePeriod = period || getCurrentPeriod();
  const activeDisease = diseaseSlug || "stunting";

  if (!isSupabaseConfigured()) {
    console.warn("[DataService] Supabase belum dikonfigurasi, pakai data lokal.");
    return rtGeoJson;
  }

  try {
    const boundariesTable = await resolveTable(TABLE_CANDIDATES.boundaries);
    if (!boundariesTable) {
      console.warn("[DataService] Tidak ditemukan tabel batas RT di Supabase.");
      return rtGeoJson;
    }

    const caseTable = getCaseTableName(activeDisease);
    const caseTableExists = await tableExists(caseTable);

    let boundariesQuery = supabase
      .from(boundariesTable)
      .select("rt_number, kelurahan, geometry")
      .order("rt_number");

    if (kelurahan) {
      boundariesQuery = boundariesQuery.eq("kelurahan", kelurahan);
    }

    let cases = [];
    let casesError = null;

    if (caseTableExists) {
      let casesQuery = supabase
        .from(caseTable)
        .select("rt_number, case_count, period, notes, updated_at, kelurahan")
        .eq("period", activePeriod)
        .order("rt_number");

      if (kelurahan) {
        casesQuery = casesQuery.eq("kelurahan", kelurahan);
      }

      const result = await casesQuery;
      cases = result.data || [];
      casesError = result.error;
    } else {
      console.warn(`[DataService] Tabel "${caseTable}" tidak ditemukan. Jalankan supabase-compat-mapping.sql.`);
    }

    const { data: boundaries, error: boundariesError } = await boundariesQuery;

    if (boundariesError) throw boundariesError;
    if (casesError) throw casesError;

    if (!boundaries || boundaries.length === 0) {
      if (kelurahan) {
        console.warn(`[DataService] ${boundariesTable} kosong untuk kelurahan "${kelurahan}".`);
        return { type: "FeatureCollection", features: [] };
      }
      console.warn(`[DataService] ${boundariesTable} kosong di Supabase, pakai data lokal.`);
      return rtGeoJson;
    }

    return toGeoJson(boundaries, cases, kelurahan, activeDisease);
  } catch (err) {
    console.error("[DataService] Error fetching data:", err.message);
    return kelurahan ? { type: "FeatureCollection", features: [] } : rtGeoJson;
  }
}

/**
 * Simpan / update data kasus untuk satu RT + satu jenis kasus + satu periode.
 * Menulis ke tabel case_<slug> masing-masing (bukan lagi 1 tabel gabungan).
 */
export async function submitCaseData({ rtNumber, diseaseSlug, caseCount, period, notes, kelurahan }) {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase belum dikonfigurasi. Tambahkan URL & key di file .env",
    };
  }

  const caseTable = getCaseTableName(diseaseSlug || "stunting");

  try {
    const caseTableExists = await tableExists(caseTable);

    if (!caseTableExists) {
      return {
        success: false,
        error: `Tabel "${caseTable}" tidak ditemukan di Supabase. Jalankan supabase-compat-mapping.sql terlebih dahulu.`,
      };
    }

    const { error } = await supabase.from(caseTable).upsert(
      {
        rt_number: rtNumber,
        case_count: Number(caseCount),
        period,
        notes: notes || null,
        kelurahan: kelurahan || "Gunung Sari Ulu",
      },
      { onConflict: "rt_number,period,kelurahan" }
    );

    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Ambil daftar entri kasus (mentah, dengan id) untuk satu jenis kasus,
 * dipakai untuk menampilkan tabel data tersimpan di Input Page
 * (mendukung Edit & Hapus).
 */
export async function fetchCaseEntries({ kelurahan, diseaseSlug }) {
  if (!isSupabaseConfigured()) return [];

  const caseTable = getCaseTableName(diseaseSlug || "stunting");

  try {
    const caseTableExists = await tableExists(caseTable);
    if (!caseTableExists) return [];

    let query = supabase
      .from(caseTable)
      .select("id, rt_number, case_count, period, notes, updated_at")
      .order("period", { ascending: false })
      .order("rt_number", { ascending: true });

    if (kelurahan) {
      query = query.eq("kelurahan", kelurahan);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("[DataService] Error fetching case entries:", err.message);
    return [];
  }
}

/**
 * Update satu entri kasus berdasarkan id (baris case_<slug> tertentu).
 * Perlu supabase-add-delete-policies.sql? Tidak, UPDATE policy sudah
 * ada dari supabase-compat-mapping.sql. File tambahan hanya untuk DELETE.
 */
export async function updateCaseData(id, diseaseSlug, { rtNumber, caseCount, period, notes }) {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase belum dikonfigurasi. Tambahkan URL & key di file .env",
    };
  }

  const caseTable = getCaseTableName(diseaseSlug || "stunting");

  try {
    const { error } = await supabase
      .from(caseTable)
      .update({
        rt_number: rtNumber,
        case_count: Number(caseCount),
        period,
        notes: notes || null,
      })
      .eq("id", id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Hapus satu entri kasus berdasarkan id.
 * Butuh policy DELETE di Supabase — jalankan supabase-add-delete-policies.sql.
 */
export async function deleteCaseData(id, diseaseSlug) {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: "Supabase belum dikonfigurasi. Tambahkan URL & key di file .env",
    };
  }

  const caseTable = getCaseTableName(diseaseSlug || "stunting");

  try {
    const { error } = await supabase.from(caseTable).delete().eq("id", id);
    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function submitStuntingData({ rtNumber, stuntingCount, period, notes, kelurahan }) {
  return submitCaseData({
    rtNumber,
    diseaseSlug: "stunting",
    caseCount: stuntingCount,
    period,
    notes,
    kelurahan,
  });
}

/**
 * Get list of RT numbers from Supabase boundaries (for the dropdown),
 * filtered per kelurahan akun yang login kalau tersedia.
 */
export async function getRTNumbers(kelurahan) {
  if (!isSupabaseConfigured()) {
    return rtGeoJson.features.map((f) => f.properties.rt_number).sort();
  }

  const boundariesTable = await resolveTable(TABLE_CANDIDATES.boundaries);
  if (!boundariesTable) {
    return kelurahan ? [] : rtGeoJson.features.map((f) => f.properties.rt_number).sort();
  }

  let query = supabase.from(boundariesTable).select("rt_number").order("rt_number");
  if (kelurahan) query = query.eq("kelurahan", kelurahan);

  const { data, error } = await query;

  if (error) {
    console.error("[DataService] Error fetching RT numbers:", error.message);
    return kelurahan ? [] : rtGeoJson.features.map((f) => f.properties.rt_number).sort();
  }

  if (!data || data.length === 0) {
    return kelurahan ? [] : rtGeoJson.features.map((f) => f.properties.rt_number).sort();
  }

  return data.map((row) => row.rt_number);
}

/**
 * Get current period string (YYYY-MM).
 */
export function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}