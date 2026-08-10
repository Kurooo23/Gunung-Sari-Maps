import { useEffect, useMemo, useState } from "react";
import {
  submitCaseData,
  updateCaseData,
  deleteCaseData,
  fetchCaseEntries,
  fetchDiseaseDefinitions,
  getRTNumbers,
  getCurrentPeriod,
} from "../lib/dataService";
import { useAuth } from "../lib/useAuth";

const currentPeriod = getCurrentPeriod();

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatPeriodLabel(period) {
  if (!period) return "-";
  const [year, month] = period.split("-");
  const namaBulan = NAMA_BULAN[Number(month) - 1] || month;
  return `${namaBulan} ${year}`;
}

function formatUpdatedAt(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countBadgeClass(count) {
  if (count === 0) return "badge-green";
  if (count <= 2) return "badge-yellow";
  return "badge-red";
}

const emptyForm = (diseaseSlug) => ({
  rtNumber: "",
  diseaseSlug,
  caseCount: "",
  period: currentPeriod,
  notes: "",
});

export default function InputPage() {
  const { user } = useAuth();
  const kelurahan = user?.user_metadata?.kelurahan;
  const [rtNumbers, setRTNumbers] = useState([]);
  const [diseaseOptions, setDiseaseOptions] = useState([]);
  const [formData, setFormData] = useState(emptyForm("stunting"));

  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entrySearch, setEntrySearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const activeDisease = diseaseOptions.find((disease) => disease.slug === formData.diseaseSlug) || diseaseOptions[0] || { slug: "stunting", display_name: "Stunting" };
  const isEditing = Boolean(editingId);

  useEffect(() => {
    getRTNumbers(kelurahan).then(setRTNumbers);
    fetchDiseaseDefinitions().then(setDiseaseOptions);
  }, [kelurahan]);

  const loadEntries = async () => {
    setEntriesLoading(true);
    const data = await fetchCaseEntries({ kelurahan, diseaseSlug: formData.diseaseSlug });
    setEntries(data);
    setEntriesLoading(false);
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelurahan, formData.diseaseSlug]);

  const filteredEntries = useMemo(() => {
    const keyword = entrySearch.trim().toLowerCase();
    if (!keyword) return entries;
    return entries.filter((entry) =>
      String(entry.rt_number).toLowerCase().includes(keyword) ||
      (entry.notes || "").toLowerCase().includes(keyword)
    );
  }, [entries, entrySearch]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = (diseaseSlug = formData.diseaseSlug) => {
    setFormData(emptyForm(diseaseSlug));
    setEditingId(null);
  };

  const handleEdit = (entry) => {
    setFormData({
      rtNumber: entry.rt_number,
      diseaseSlug: formData.diseaseSlug,
      caseCount: String(entry.case_count),
      period: entry.period,
      notes: entry.notes || "",
    });
    setEditingId(entry.id);
    setStatus(null);
  };

  const handleCancelEdit = () => {
    resetForm();
    setStatus(null);
  };

  const handleDelete = async (entry) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus data RT ${entry.rt_number} periode ${formatPeriodLabel(entry.period)}?`
    );
    if (!confirmed) return;

    setDeletingId(entry.id);
    const result = await deleteCaseData(entry.id, formData.diseaseSlug);
    setDeletingId(null);

    if (result.success) {
      setStatus({ type: "success", message: `Data RT ${entry.rt_number} berhasil dihapus.` });
      if (editingId === entry.id) resetForm();
      loadEntries();
    } else {
      setStatus({ type: "error", message: result.error });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.rtNumber) {
      setStatus({ type: "error", message: "Pilih nomor RT terlebih dahulu." });
      return;
    }
    if (formData.caseCount === "" || Number(formData.caseCount) < 0) {
      setStatus({ type: "error", message: "Masukkan jumlah kasus yang valid." });
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    const payload = {
      rtNumber: formData.rtNumber,
      diseaseSlug: formData.diseaseSlug,
      caseCount: Number(formData.caseCount),
      period: formData.period,
      notes: formData.notes,
      kelurahan,
    };

    const result = isEditing
      ? await updateCaseData(editingId, formData.diseaseSlug, payload)
      : await submitCaseData(payload);

    if (result.success) {
      setStatus({
        type: "success",
        message: isEditing
          ? `Data RT ${formData.rtNumber} untuk ${activeDisease.display_name || activeDisease.name} berhasil diperbarui!`
          : `Data RT ${formData.rtNumber} untuk ${activeDisease.display_name || activeDisease.name} berhasil disimpan!`,
      });
      resetForm();
      loadEntries();
    } else {
      setStatus({ type: "error", message: result.error });
    }

    setIsSubmitting(false);
  };

  return (
    <div className="input-page">
      <div className="input-primary">
        <div className="input-card">
          <div className="input-header">
            <h2>{isEditing ? "Edit Data Kasus" : "Input Data Kasus"}</h2>
            <p>
              {isEditing
                ? `Mengubah data RT ${formData.rtNumber} periode ${formatPeriodLabel(formData.period)}.`
                : "Formulir pengisian data kasus per RT untuk berbagai penyakit yang dipetakan."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="input-form">
            <div className="form-group">
              <label htmlFor="rtNumber">Nomor RT</label>
              <select id="rtNumber" name="rtNumber" value={formData.rtNumber} onChange={handleChange} required>
                <option value="">-- Pilih RT --</option>
                {rtNumbers.map((rt) => (
                  <option key={rt} value={rt}>RT {rt}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="diseaseSlug">Jenis Kasus</label>
              <select
                id="diseaseSlug"
                name="diseaseSlug"
                value={formData.diseaseSlug}
                onChange={handleChange}
                disabled={isEditing}
                required
              >
                {diseaseOptions.map((disease) => (
                  <option key={disease.slug} value={disease.slug}>
                    {disease.display_name || disease.name}
                  </option>
                ))}
              </select>
              {isEditing && (
                <span className="form-hint">Jenis kasus tidak bisa diubah saat mode edit. Batalkan dulu jika ingin ganti.</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="caseCount">Jumlah Kasus {activeDisease.display_name || activeDisease.name}</label>
              <input
                type="number"
                id="caseCount"
                name="caseCount"
                min="0"
                max="100"
                value={formData.caseCount}
                onChange={handleChange}
                placeholder="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="period">Periode</label>
              <input type="month" id="period" name="period" value={formData.period} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Catatan (opsional)</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Tambahkan catatan jika perlu..."
                rows={3}
              />
            </div>

            {status && <div className={`form-status ${status.type}`}>{status.message}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : isEditing ? "Update Data" : "Simpan Data"}
              </button>
              {isEditing && (
                <button type="button" className="btn-cancel" onClick={handleCancelEdit} disabled={isSubmitting}>
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="input-entries-card">
          <div className="entries-header">
            <h3>Data Tersimpan &mdash; {activeDisease.display_name || activeDisease.name}</h3>
            <input
              type="text"
              className="entries-search"
              placeholder="Cari RT atau catatan..."
              value={entrySearch}
              onChange={(e) => setEntrySearch(e.target.value)}
            />
          </div>

          {entriesLoading ? (
            <p className="entries-empty">Memuat data...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="entries-empty">
              {entrySearch ? "Tidak ada data yang cocok dengan pencarian." : "Belum ada data tersimpan untuk jenis kasus ini."}
            </p>
          ) : (
            <div className="entries-table-wrap">
              <table className="entries-table">
                <thead>
                  <tr>
                    <th>RT</th>
                    <th>Periode</th>
                    <th>Jumlah</th>
                    <th>Catatan</th>
                    <th>Diperbarui</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className={editingId === entry.id ? "row-editing" : ""}>
                      <td data-label="RT">RT {entry.rt_number}</td>
                      <td data-label="Periode">{formatPeriodLabel(entry.period)}</td>
                      <td data-label="Jumlah">
                        <span className={`count-badge ${countBadgeClass(entry.case_count)}`}>{entry.case_count}</span>
                      </td>
                      <td data-label="Catatan" className="entries-notes">{entry.notes || "-"}</td>
                      <td data-label="Diperbarui">{formatUpdatedAt(entry.updated_at)}</td>
                      <td data-label="Aksi" className="entries-actions">
                        <button type="button" className="btn-edit" onClick={() => handleEdit(entry)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => handleDelete(entry)}
                          disabled={deletingId === entry.id}
                        >
                          {deletingId === entry.id ? "..." : "Hapus"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="input-info">
        <h3>Panduan Pengisian</h3>
        <div className="info-items">
          <div className="info-item">
            <span className="info-dot green"></span>
            <span><strong>0 kasus</strong> = Hijau (tidak ada kasus)</span>
          </div>
          <div className="info-item">
            <span className="info-dot yellow"></span>
            <span><strong>1 - 2 kasus</strong> = Kuning (waspada)</span>
          </div>
          <div className="info-item">
            <span className="info-dot red"></span>
            <span><strong>3+ kasus</strong> = Merah (perlu penanganan)</span>
          </div>
        </div>
        <p className="info-note">
          Data yang disimpan akan otomatis muncul di halaman peta.
          Pastikan data sesuai dengan hasil pencatatan terbaru. Klik
          <strong> Edit</strong> pada tabel untuk mengubah data yang sudah ada,
          atau <strong>Hapus</strong> untuk menghapusnya.
        </p>
      </div>
    </div>
  );
}
