import { useEffect, useMemo, useState } from "react";
import {
  updateCaseData,
  deleteCaseData,
  fetchCaseEntries,
  fetchDiseaseDefinitions,
  getRTNumbers,
} from "../lib/dataService";
import {
  formatPeriodLabel,
  formatUpdatedAtTimestamp,
  getCaseCountBadgeClass,
} from "../lib/formatters";
import { useAuth } from "../lib/useAuth";

const PAGE_SIZE = 10;

export default function DataPage() {
  const { user } = useAuth();
  const kelurahan = user?.user_metadata?.kelurahan;

  const [rtNumbers, setRTNumbers] = useState([]);
  const [diseaseOptions, setDiseaseOptions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  const [selectedDisease, setSelectedDisease] = useState("all");
  const [selectedRT, setSelectedRT] = useState("all");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [entrySearch, setEntrySearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [status, setStatus] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);

  const [editingEntry, setEditingEntry] = useState(null);
  const [editForm, setEditForm] = useState({
    rtNumber: "",
    diseaseSlug: "",
    diseaseName: "",
    caseCount: "",
    period: "",
    notes: "",
  });
  const [editError, setEditError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    getRTNumbers(kelurahan).then(setRTNumbers);
    fetchDiseaseDefinitions().then(setDiseaseOptions);
  }, [kelurahan]);

  const loadEntries = async () => {
    setEntriesLoading(true);
    const data = await fetchCaseEntries({ kelurahan, diseaseSlug: "all" });
    setEntries(data);
    setEntriesLoading(false);
  };

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelurahan]);

  const availableRTNumbers = useMemo(() => {
    const rtSet = new Set();
    rtNumbers.forEach((rtNumberValue) => {
      if (rtNumberValue) rtSet.add(String(rtNumberValue).trim().padStart(2, "0"));
    });
    entries.forEach((entry) => {
      if (entry.rt_number) rtSet.add(String(entry.rt_number).trim().padStart(2, "0"));
    });
    return Array.from(rtSet).sort((firstRT, secondRT) => Number(firstRT) - Number(secondRT));
  }, [rtNumbers, entries]);

  const filteredEntries = useMemo(() => {
    const keyword = entrySearch.trim().toLowerCase();
    return entries.filter((entry) => {
      if (selectedDisease !== "all" && entry.disease_slug !== selectedDisease) {
        return false;
      }
      if (
        selectedRT !== "all" &&
        String(entry.rt_number).trim().padStart(2, "0") !==
          String(selectedRT).trim().padStart(2, "0")
      ) {
        return false;
      }
      if (selectedPeriod && entry.period !== selectedPeriod) {
        return false;
      }
      if (!keyword) return true;

      const rtMatch =
        `rt ${entry.rt_number}`.toLowerCase().includes(keyword) ||
        String(entry.rt_number).toLowerCase().includes(keyword);
      const diseaseMatch = (entry.disease_name || "").toLowerCase().includes(keyword);
      const notesMatch = (entry.notes || "").toLowerCase().includes(keyword);
      const periodMatch = formatPeriodLabel(entry.period).toLowerCase().includes(keyword);
      return rtMatch || diseaseMatch || notesMatch || periodMatch;
    });
  }, [entries, selectedDisease, selectedRT, selectedPeriod, entrySearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDisease, selectedRT, selectedPeriod, entrySearch]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedEntries = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredEntries.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredEntries, safePage]);

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPages }, (_unused, index) => index + 1);
  }, [totalPages]);

  const handleOpenEdit = (entry) => {
    setEditingEntry(entry);
    setEditForm({
      rtNumber: entry.rt_number,
      diseaseSlug: entry.disease_slug,
      diseaseName: entry.disease_name || entry.disease_slug,
      caseCount: String(entry.case_count),
      period: entry.period,
      notes: entry.notes || "",
    });
    setEditError(null);
    setStatus(null);
  };

  const handleCloseEdit = () => {
    if (isUpdating) return;
    setEditingEntry(null);
    setEditError(null);
  };

  const handleEditFieldChange = (event) => {
    const { name, value } = event.target;
    setEditForm((previousForm) => ({ ...previousForm, [name]: value }));
  };

  const handleEditFormSubmit = async (event) => {
    event.preventDefault();
    if (!editingEntry) return;

    if (!editForm.rtNumber) {
      setEditError("Pilih nomor RT terlebih dahulu.");
      return;
    }
    if (editForm.caseCount === "" || Number(editForm.caseCount) < 0) {
      setEditError("Masukkan jumlah kasus yang valid.");
      return;
    }

    setIsUpdating(true);
    setEditError(null);

    const result = await updateCaseData(editingEntry.id, editingEntry.disease_slug, {
      rtNumber: editForm.rtNumber,
      caseCount: Number(editForm.caseCount),
      period: editForm.period,
      notes: editForm.notes,
    });

    setIsUpdating(false);

    if (result.success) {
      setStatus({
        type: "success",
        message: `Data RT ${editForm.rtNumber} (${editForm.diseaseName}) berhasil diperbarui!`,
      });
      setEditingEntry(null);
      loadEntries();
    } else {
      setEditError(result.error);
    }
  };

  const handleDelete = async (entry) => {
    const confirmed = window.confirm(
      `Yakin ingin menghapus data ${entry.disease_name || "kasus"} RT ${entry.rt_number} periode ${formatPeriodLabel(entry.period)}?`
    );
    if (!confirmed) return;

    const entryKey = `${entry.disease_slug}-${entry.id}`;
    setDeletingKey(entryKey);
    const result = await deleteCaseData(entry.id, entry.disease_slug);
    setDeletingKey(null);

    if (result.success) {
      setStatus({
        type: "success",
        message: `Data ${entry.disease_name || "kasus"} RT ${entry.rt_number} berhasil dihapus.`,
      });
      if (
        editingEntry &&
        editingEntry.id === entry.id &&
        editingEntry.disease_slug === entry.disease_slug
      ) {
        setEditingEntry(null);
      }
      loadEntries();
    } else {
      setStatus({ type: "error", message: result.error });
    }
  };

  const activeDiseaseLabel = useMemo(() => {
    if (selectedDisease === "all") return "Semua Jenis Kasus";
    const foundDisease = diseaseOptions.find((disease) => disease.slug === selectedDisease);
    return foundDisease ? foundDisease.display_name || foundDisease.name : selectedDisease;
  }, [selectedDisease, diseaseOptions]);

  return (
    <div className="data-page">
      <div className="data-container">
        <div className="input-entries-card data-card">
          <div className="data-page-header">
            <div className="data-title-group">
              <h2>Data Tersimpan &mdash; {activeDiseaseLabel}</h2>
              <p>
                Daftar seluruh data kasus per RT yang telah dicatat. Anda dapat memfilter,
                mengubah, atau menghapus data di sini.
              </p>
            </div>
          </div>

          <div className="data-filters">
            <div className="filter-item">
              <label htmlFor="filterDisease">Jenis Kasus</label>
              <select
                id="filterDisease"
                value={selectedDisease}
                onChange={(event) => setSelectedDisease(event.target.value)}
              >
                <option value="all">Semua Jenis Kasus</option>
                {diseaseOptions.map((disease) => (
                  <option key={disease.slug} value={disease.slug}>
                    {disease.display_name || disease.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label htmlFor="filterRT">Nomor RT</label>
              <select
                id="filterRT"
                value={selectedRT}
                onChange={(event) => setSelectedRT(event.target.value)}
              >
                <option value="all">Semua RT</option>
                {availableRTNumbers.map((rtNumberOption) => (
                  <option key={rtNumberOption} value={rtNumberOption}>
                    RT {rtNumberOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item filter-period">
              <label htmlFor="filterPeriod">Periode</label>
              <div className="period-filter-control">
                <input
                  id="filterPeriod"
                  type="month"
                  value={selectedPeriod}
                  onChange={(event) => setSelectedPeriod(event.target.value)}
                />
                {selectedPeriod && (
                  <button
                    type="button"
                    className="btn-clear-period"
                    onClick={() => setSelectedPeriod("")}
                    title="Tampilkan semua periode"
                  >
                    Semua
                  </button>
                )}
              </div>
            </div>

            <div className="filter-item filter-search">
              <label htmlFor="filterSearch">Pencarian</label>
              <input
                id="filterSearch"
                type="text"
                className="entries-search"
                placeholder="Cari catatan atau kata kunci..."
                value={entrySearch}
                onChange={(event) => setEntrySearch(event.target.value)}
              />
            </div>
          </div>

          {status && (
            <div className={`form-status ${status.type} data-status`}>
              <span>{status.message}</span>
            </div>
          )}

          {!entriesLoading && (
            <p className="entries-count">
              Menampilkan <strong>{filteredEntries.length}</strong> dari{" "}
              <strong>{entries.length}</strong> total data tersimpan
            </p>
          )}

          {entriesLoading ? (
            <p className="entries-empty">Memuat data...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="entries-empty">
              {entrySearch ||
              selectedDisease !== "all" ||
              selectedRT !== "all" ||
              Boolean(selectedPeriod)
                ? "Tidak ada data yang cocok dengan filter atau pencarian."
                : "Belum ada data kasus yang tersimpan."}
            </p>
          ) : (
            <>
              <div className="entries-table-wrap">
                <table className="entries-table">
                  <thead>
                    <tr>
                      <th>RT</th>
                      <th>Jenis Kasus</th>
                      <th>Periode</th>
                      <th>Jumlah</th>
                      <th>Catatan</th>
                      <th>Diperbarui</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEntries.map((entry) => {
                      const entryKey = `${entry.disease_slug}-${entry.id}`;
                      const isRowEditing =
                        editingEntry &&
                        editingEntry.id === entry.id &&
                        editingEntry.disease_slug === entry.disease_slug;

                      return (
                        <tr key={entryKey} className={isRowEditing ? "row-editing" : ""}>
                          <td data-label="RT">
                            <strong>RT {entry.rt_number}</strong>
                          </td>
                          <td data-label="Jenis Kasus">
                            <span className="disease-badge">{entry.disease_name}</span>
                          </td>
                          <td data-label="Periode">{formatPeriodLabel(entry.period)}</td>
                          <td data-label="Jumlah">
                            <span
                              className={`count-badge ${getCaseCountBadgeClass(entry.case_count)}`}
                            >
                              {entry.case_count}
                            </span>
                          </td>
                          <td data-label="Catatan" className="entries-notes">
                            <span className="notes-content">{entry.notes || "-"}</span>
                          </td>
                          <td data-label="Diperbarui">
                            {formatUpdatedAtTimestamp(entry.updated_at)}
                          </td>
                          <td data-label="Aksi" className="entries-actions">
                            <div className="action-buttons">
                              <button
                                type="button"
                                className="btn-edit"
                                onClick={() => handleOpenEdit(entry)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-delete"
                                onClick={() => handleDelete(entry)}
                                disabled={deletingKey === entryKey}
                              >
                                {deletingKey === entryKey ? "..." : "Hapus"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="entries-pagination">
                  <button
                    type="button"
                    className="btn-page"
                    onClick={() =>
                      setCurrentPage((previousPage) => Math.max(1, previousPage - 1))
                    }
                    disabled={safePage === 1}
                  >
                    &larr; Sebelumnya
                  </button>
                  <div className="page-numbers">
                    {pageNumbers.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`btn-page-number ${pageNumber === safePage ? "active" : ""}`}
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn-page"
                    onClick={() =>
                      setCurrentPage((previousPage) => Math.min(totalPages, previousPage + 1))
                    }
                    disabled={safePage === totalPages}
                  >
                    Berikutnya &rarr;
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {editingEntry && (
        <div className="edit-modal-backdrop" onClick={handleCloseEdit}>
          <div className="edit-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="input-header">
              <h2>Edit Data Kasus</h2>
              <p>
                Mengubah data <strong>{editForm.diseaseName}</strong> RT {editForm.rtNumber}{" "}
                periode {formatPeriodLabel(editForm.period)}.
              </p>
            </div>

            <form onSubmit={handleEditFormSubmit} className="input-form">
              <div className="form-group">
                <label htmlFor="edit-rtNumber">Nomor RT</label>
                <select
                  id="edit-rtNumber"
                  name="rtNumber"
                  value={editForm.rtNumber}
                  onChange={handleEditFieldChange}
                  required
                >
                  <option value="">-- Pilih RT --</option>
                  {availableRTNumbers.map((rtNumberOption) => (
                    <option key={rtNumberOption} value={rtNumberOption}>
                      RT {rtNumberOption}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="edit-disease">Jenis Kasus</label>
                <input
                  id="edit-disease"
                  type="text"
                  value={editForm.diseaseName}
                  disabled
                />
                <span className="form-hint">
                  Jenis kasus tidak dapat diubah saat mode edit.
                </span>
              </div>

              <div className="form-group">
                <label htmlFor="edit-caseCount">Jumlah Kasus {editForm.diseaseName}</label>
                <input
                  type="number"
                  id="edit-caseCount"
                  name="caseCount"
                  min="0"
                  max="100"
                  value={editForm.caseCount}
                  onChange={handleEditFieldChange}
                  placeholder="0"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-period">Periode</label>
                <input
                  type="month"
                  id="edit-period"
                  name="period"
                  value={editForm.period}
                  onChange={handleEditFieldChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-notes">Catatan (opsional)</label>
                <textarea
                  id="edit-notes"
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditFieldChange}
                  placeholder="Tambahkan catatan jika perlu..."
                  rows={3}
                />
              </div>

              {editError && <div className="form-status error">{editError}</div>}

              <div className="form-actions">
                <button type="submit" className="btn-submit" disabled={isUpdating}>
                  {isUpdating ? "Menyimpan..." : "Update Data"}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={handleCloseEdit}
                  disabled={isUpdating}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
