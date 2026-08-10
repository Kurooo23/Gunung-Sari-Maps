import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import "./Login.css";

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 5.5h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M2.5 6.2 10 11l7.5-4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      {off && <path d="M2.5 17.5 17.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 16c-.6-6.5 3.4-11 12-11 .6 6.9-3.3 11-12 11Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M4.5 15.5 13 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// Kurva "pertumbuhan" -- pita hijau/kuning/merah proporsional dengan
// sebaran status RT sungguhan (kurang lebih 29 hijau : 11 kuning : 1 merah
// dari 41 RT), disatukan garis naik ala grafik KMS/pemantauan balita.
// viewBox dibuat portrait supaya mengisi panel penuh tinggi layar,
// bukan sekadar ilustrasi kecil di dalam kartu.
function GrowthSignature() {
  return (
    <svg
      className="growth-signature"
      viewBox="0 0 460 820"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bandGradient" x1="0" y1="820" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e4574b" stopOpacity="0.55" />
          <stop offset="0.16" stopColor="#f2a93c" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#2f9e6d" stopOpacity="0.42" />
          <stop offset="1" stopColor="#2f9e6d" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id="curveStroke" x1="0" y1="820" x2="460" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="460" height="820" fill="url(#bandGradient)" />

      <path
        className="growth-curve-line"
        d="M30 760 C 90 770, 120 620, 140 560 C 165 480, 150 400, 230 320 C 290 260, 270 200, 350 130 C 385 100, 395 85, 410 60"
        stroke="url(#curveStroke)"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {[
        [30, 760],
        [140, 560],
        [230, 320],
        [410, 60],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="6" fill="#ffffff" fillOpacity="0.85" />
      ))}

      <circle className="growth-curve-dot" cx="410" cy="60" r="9" fill="#ffffff" />
      <circle className="growth-curve-pulse" cx="410" cy="60" r="9" fill="#ffffff" />
    </svg>
  );
}

// Terjemahkan kode error jadi pesan yang jelas dan spesifik.
// email_not_found / wrong_password dibedakan lewat RPC
// check_email_exists di Supabase (lihat AuthProvider.jsx +
// check_email_exists.sql). Ini sedikit membuka celah enumerasi akun --
// diterima di sini karena akun dibuatkan admin Puskesmas, bukan
// pendaftaran publik. invalid_credentials dipakai sebagai fallback aman
// kalau RPC itu belum terpasang atau gagal dipanggil.
function mapAuthError(errorCode) {
  switch (errorCode) {
    case "email_not_found":
      return "Email tidak ditemukan.";
    case "wrong_password":
      return "Kata sandi salah. Coba periksa lagi.";
    case "invalid_credentials":
      return "Email atau kata sandi tidak cocok. Coba periksa lagi.";
    case "email_not_confirmed":
      return "Email belum dikonfirmasi. Cek kotak masuk email Anda untuk tautan verifikasi.";
    case "too_many_requests":
      return "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.";
    case "network_error":
      return "Gagal terhubung ke server. Periksa koneksi internet Anda.";
    default:
      return "Terjadi kesalahan saat masuk. Coba lagi sebentar lagi.";
  }
}

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sudah login? langsung lempar ke halaman peta (atau halaman asal jika ada)
  if (!loading && user) {
    const redirectTo = location.state?.from?.pathname || "/peta";
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(email, password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(mapAuthError(result.errorCode));
      return;
    }

    const redirectTo = location.state?.from?.pathname || "/peta";
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-shell">
        {/* Panel identitas */}
        <div className="login-visual">
          <GrowthSignature />

          <div className="login-brand">
            <span className="login-brand-mark">
              <LeafIcon />
            </span>
            <span className="login-brand-name">Peta Digital</span>
          </div>

          <div className="login-visual-content">
            <span className="login-eyebrow">UNTUK PUSKESMAS KELURAHAN GUNUNG SARI ULU</span>
            <h1 className="login-headline">
              Selamat <em>Datang.</em>
            </h1>
            <p className="login-tagline">
              Terima kasih sudah menjaga tumbuh kembang anak-anak di wilayahmu.
              Masuk untuk mulai mencatat dan memantau data hari ini.
            </p>

            <div className="login-chips">
              <span className="login-chip">Peta per RT</span>
              <span className="login-chip">Sesuai wilayah kerja akun Anda</span>
              <span className="login-chip">Balikpapan Tengah</span>
            </div>
          </div>
        </div>

        {/* Panel form */}
        <div className="login-panel">
          <div className="login-panel-inner">
            <div className="login-panel-header">
              <h2>Masuk ke Akun</h2>
              <p>Gunakan akun yang diberikan oleh admin Puskesmas.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <label className="login-label" htmlFor="login-email">
                Email
                <div className="login-input-wrap">
                  <span className="login-input-icon"><MailIcon /></span>
                  <input
                    id="login-email"
                    type="email"
                    className="login-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@puskesmas.go.id"
                    autoComplete="username"
                  />
                </div>
              </label>

              <label className="login-label" htmlFor="login-password">
                Kata Sandi
                <div className="login-input-wrap">
                  <span className="login-input-icon"><LockIcon /></span>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className="login-input login-input-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-eye-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </label>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" className="login-button" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    Memproses...
                  </>
                ) : (
                  "Masuk"
                )}
              </button>

              <p className="login-footnote">
                Lupa kata sandi? Hubungi admin Puskesmas setempat.
              </p>
            </form>
          </div>
        </div>
      </div>

      <p className="login-signature">
        Website ini dibuat oleh tim KKN 52 Universitas Mulawarman
      </p>
    </div>
  );
}