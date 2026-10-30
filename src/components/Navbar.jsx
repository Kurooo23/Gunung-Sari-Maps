import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 18-5 2V6l5-2 6 2 5-2v14l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5V3h6v1.5M9 10h6M9 14h4" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 10v10" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="m17 8 4 4-4 4M21 12H9" />
    </svg>
  );
}

export default function Navbar() {
  const { user, signOut } = useAuth();
  const metadata = user?.user_metadata || {};
  const displayName = metadata.full_name || metadata.name || user?.email?.split("@")[0] || "Kader";
  const kelurahan = metadata.kelurahan || "Gunung Sari Ulu";
  const kota = metadata.kota || "Balikpapan";
  const role = metadata.role || "Kader Puskesmas";
  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="header-left">
          <p className="brand-kicker">Peta digital</p>
          <h1>PETA PERSEBARAN PENYAKIT</h1>
          <span className="header-subtitle">{kelurahan} &middot; {kota}</span>
        </div>
      </div>
      <nav className="header-nav">
        <NavLink to="/peta" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"} end>
          <MapIcon />
          <span>Peta Wilayah</span>
        </NavLink>
        <NavLink to="/input" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          <ClipboardIcon />
          <span>Catat Data</span>
        </NavLink>
        <NavLink to="/data" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
          <TableIcon />
          <span>Data Kasus</span>
        </NavLink>
      </nav>
      <div className="header-account">
        <div className="account-avatar" aria-hidden="true">{initials || "K"}</div>
        <div className="account-copy">
          <strong>{displayName}</strong>
          <span>{role}</span>
        </div>
        <button type="button" className="nav-logout" onClick={signOut} aria-label="Keluar dari akun" title="Keluar">
          <LogOutIcon />
        </button>
      </div>
    </header>
  );
}