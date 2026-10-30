import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  submitCaseData,
  fetchDiseaseDefinitions,
  getRTNumbers,
  getCurrentPeriod,
} from "../lib/dataService";
import { useAuth } from "../lib/useAuth";

const currentPeriod = getCurrentPeriod();

function createEmptyCaseForm(diseaseSlug) {
  return {
    rtNumber: "",
    diseaseSlug,
    caseCount: "",
    period: currentPeriod,
    notes: "",
  };
}

export default function InputPage() {
  const { user } = useAuth();
  const kelurahan = user?.user_metadata?.kelurahan;
  const [rtNumbers, setRTNumbers] = useState([]);
  const [diseaseOptions, setDiseaseOptions] = useState([]);
  const [formData, setFormData] = useState(createEmptyCaseForm("stunting"));

  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeDisease =
    diseaseOptions.find((disease) => disease.slug === formData.diseaseSlug) ||
    diseaseOptions[0] || { slug: "stunting", display_name: "Stunting" };

  useEffect(() => {
    getRTNumbers(kelurahan).then(setRTNumbers);
    fetchDiseaseDefinitions().then(setDiseaseOptions);
  }, [kelurahan]);

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormData((previousForm) => ({ ...previousForm, [name]: value }));
  };

  const resetForm = (diseaseSlug = formData.diseaseSlug) => {
    setFormData(createEmptyCaseForm(diseaseSlug));
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

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

    const result = await submitCaseData(payload);

    if (result.success) {
      setStatus({
        type: "success",
        message: `Data RT ${formData.rtNumber} untuk ${activeDisease.display_name || activeDisease.name} berhasil disimpan!`,
      });
      resetForm();
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
            <h2>Input Data Kasus</h2>
            <p>Formulir pengisian data kasus per RT untuk berbagai penyakit yang dipetakan.</p>
          </div>

          <form onSubmit={handleFormSubmit} className="input-form">
            <div className="form-group">
              <label htmlFor="rtNumber">Nomor RT</label>
              <select
                id="rtNumber"
                name="rtNumber"
                value={formData.rtNumber}
                onChange={handleFieldChange}
                required
              >
                <option value="">-- Pilih RT --</option>
                {rtNumbers.map((rtNumberOption) => (
                  <option key={rtNumberOption} value={rtNumberOption}>
                    RT {rtNumberOption}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="diseaseSlug">Jenis Kasus</label>
              <select
                id="diseaseSlug"
                name="diseaseSlug"
                value={formData.diseaseSlug}
                onChange={handleFieldChange}
                required
              >
                {diseaseOptions.map((disease) => (
                  <option key={disease.slug} value={disease.slug}>
                    {disease.display_name || disease.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="caseCount">
                Jumlah Kasus {activeDisease.display_name || activeDisease.name}
              </label>
              <input
                type="number"
                id="caseCount"
                name="caseCount"
                min="0"
                max="100"
                value={formData.caseCount}
                onChange={handleFieldChange}
                placeholder="0"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="period">Periode</label>
              <input
                type="month"
                id="period"
                name="period"
                value={formData.period}
                onChange={handleFieldChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Catatan (opsional)</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleFieldChange}
                placeholder="Tambahkan catatan jika perlu..."
                rows={3}
              />
            </div>

            {status && <div className={`form-status ${status.type}`}>{status.message}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </div>
          </form>
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
          Pastikan data sesuai dengan hasil pencatatan terbaru. Untuk melihat
          seluruh data tersimpan, mengubah, atau menghapus data, silakan buka halaman{" "}
          <Link to="/data" className="info-link">Data Kasus</Link>.
        </p>
      </div>
    </div>
  );
}
