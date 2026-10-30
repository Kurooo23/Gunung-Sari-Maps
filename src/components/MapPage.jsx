import { useState, useEffect, useMemo } from "react";
import MapComponent from "./MapComponent";
import { fetchDiseaseDefinitions, fetchRTData, getCurrentPeriod } from "../lib/dataService";
import { formatPeriodLabel } from "../lib/formatters";
import { useAuth } from "../lib/useAuth";

function getFeatureCaseCount(feature) {
  return Number(feature.properties.case_count ?? feature.properties.stunting_count ?? 0);
}

export default function MapPage() {
  const { user } = useAuth();
  const kelurahan = user?.user_metadata?.kelurahan;
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [diseaseOptions, setDiseaseOptions] = useState([]);
  const [diseaseSlug, setDiseaseSlug] = useState("stunting");
  const [dataVersion, setDataVersion] = useState(0);

  const activeDisease = useMemo(() => {
    return (
      diseaseOptions.find((disease) => disease.slug === diseaseSlug) ||
      diseaseOptions[0] || { slug: "stunting", display_name: "Stunting" }
    );
  }, [diseaseOptions, diseaseSlug]);

  useEffect(() => {
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "image";
    preloadLink.href = "/peta-map-bg.webp";
    preloadLink.fetchPriority = "high";
    document.head.appendChild(preloadLink);
    return () => preloadLink.remove();
  }, []);

  useEffect(() => {
    fetchDiseaseDefinitions().then(setDiseaseOptions);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    async function loadMapData() {
      setLoading(true);
      const data = await fetchRTData(kelurahan, period, diseaseSlug);
      if (isCancelled) return;
      setGeoJsonData(data);
      setDataVersion((previousVersion) => previousVersion + 1);
      setLoading(false);
    }
    loadMapData();
    return () => {
      isCancelled = true;
    };
  }, [kelurahan, period, diseaseSlug]);

  const stats = useMemo(() => {
    if (!geoJsonData?.features) return null;
    const features = geoJsonData.features;
    const totalRT = features.length;
    const rtWithCases = features.filter((feature) => getFeatureCaseCount(feature) > 0).length;
    const totalCases = features.reduce(
      (sum, feature) => sum + getFeatureCaseCount(feature),
      0
    );
    const rtHijau = features.filter((feature) => getFeatureCaseCount(feature) === 0).length;
    const rtKuning = features.filter((feature) => {
      const count = getFeatureCaseCount(feature);
      return count >= 1 && count <= 2;
    }).length;
    const rtMerah = features.filter((feature) => getFeatureCaseCount(feature) >= 3).length;

    return { totalRT, rtWithCases, totalCases, rtHijau, rtKuning, rtMerah };
  }, [geoJsonData]);

  if (!geoJsonData || !stats) {
    return (
      <div className="map-page">
        <aside className="sidebar">
          <div className="sidebar-section">
            <h2>Ringkasan</h2>
          </div>
        </aside>
        <div className="map-wrapper">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Memuat data peta...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      <aside className="sidebar">
        <div className="sidebar-section">
          <h2>Ringkasan</h2>
          <div className="sidebar-controls">
            <label htmlFor="disease-select">Jenis kasus</label>
            <select
              id="disease-select"
              value={diseaseSlug}
              onChange={(event) => setDiseaseSlug(event.target.value)}
            >
              {diseaseOptions.map((disease) => (
                <option key={disease.slug} value={disease.slug}>
                  {disease.display_name || disease.name}
                </option>
              ))}
            </select>
          </div>
          <div className="period-picker">
            <label htmlFor="periode-peta">Periode data</label>
            <input
              type="month"
              id="periode-peta"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            />
            <span className="period-picker-label">
              {loading ? "Memuat..." : formatPeriodLabel(period)}
            </span>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-number">{stats.rtWithCases}</span>
              <span className="stat-label">Total RT</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.totalCases}</span>
              <span className="stat-label">Total Kasus</span>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <h2>Status Wilayah</h2>
          <div className="status-list">
            <div className="status-item">
              <span className="status-dot status-green"></span>
              <span className="status-text">0 Kasus (Hijau)</span>
              <span className="status-count">{stats.rtHijau} RT</span>
            </div>
            <div className="status-item">
              <span className="status-dot status-yellow"></span>
              <span className="status-text">1 - 2 Kasus (Kuning)</span>
              <span className="status-count">{stats.rtKuning} RT</span>
            </div>
            <div className="status-item">
              <span className="status-dot status-red"></span>
              <span className="status-text">3+ Kasus (Merah)</span>
              <span className="status-count">{stats.rtMerah} RT</span>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <h2>Daftar RT</h2>
          {geoJsonData.features.length === 0 && (
            <p style={{ fontSize: "0.85rem", color: "#888" }}>
              Belum ada data batas RT untuk wilayah akun ini. Hubungi admin untuk menambahkan data lewat halaman Digitizer.
            </p>
          )}
          <div className="rt-list">
            {[...geoJsonData.features]
              .sort(
                (firstFeature, secondFeature) =>
                  Number(firstFeature.properties.rt_number) -
                  Number(secondFeature.properties.rt_number)
              )
              .map((feature) => {
                const count = getFeatureCaseCount(feature);
                const colorClass = count === 0 ? "rt-green" : count <= 2 ? "rt-yellow" : "rt-red";
                return (
                  <div key={feature.properties.rt_number} className={`rt-item ${colorClass}`}>
                    <span className="rt-num">RT {feature.properties.rt_number}</span>
                    <span className="rt-count">{count} kasus</span>
                  </div>
                );
              })}
          </div>
        </div>
      </aside>

      <div className="map-wrapper">
        <MapComponent
          geoJsonData={geoJsonData}
          diseaseName={activeDisease.display_name || activeDisease.name}
          diseaseSlug={diseaseSlug}
          mapKey={dataVersion}
        />
      </div>
    </div>
  );
}
