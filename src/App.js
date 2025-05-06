import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom';

import Home from './pages/Home';
import UniverseGallery from './pages/UniverseGallery';
import GalleryWhite from './pages/GalleryWhite';
import FloatGallery from './pages/FloatGallery';
import Entry from './pages/Entry';
import GalleryView from './pages/GalleryView';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import UserManagement from './pages/UserManagement';
import EntryManagement from './pages/EntryManagement';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Tokushoho from './pages/Tokushoho';
import Copyright from './pages/Copyright'; 
import Disclaimer from './pages/Disclaimer'; 
import Faq from './pages/Faq'; 

// LayoutWithWarnings を別コンポーネントとして定義
function LayoutWithWarnings() {
  const location = useLocation();
  const isGalleryPage = ['/universe', '/white', '/float'].includes(location.pathname);

  useEffect(() => {
    if (!isGalleryPage) return;
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const warning = document.getElementById("rotate-warning");
      if (warning) {
        warning.style.display = isPortrait ? "flex" : "none";
      }
    };
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("load", checkOrientation);
    checkOrientation();
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("load", checkOrientation);
    };
  }, [isGalleryPage]);

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
  };

  return (
    <>
      {isGalleryPage && (
        <>
          <div id="rotate-warning" style={{
            display: "none",
            position: "fixed",
            top: 0, left: 0,
            width: "100vw", height: "100vh",
            backgroundColor: "rgba(0,0,0,0.85)",
            color: "white",
            fontSize: "1.5em",
            zIndex: 9999,
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center"
          }}>
            横画面での鑑賞をおすすめします
          </div>
          <button onClick={enterFullscreen} style={{
            position: "fixed",
            bottom: "10px", right: "10px",
            zIndex: 10000,
            padding: "10px 20px",
            backgroundColor: "white",
            color: "black",
            borderRadius: "5px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
          }}>
            全画面にする
          </button>
        </>
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/universe" element={<UniverseGallery />} />
        <Route path="/white" element={<GalleryWhite />} />
        <Route path="/float" element={<FloatGallery />} />
        <Route path="/entry" element={<Entry />} />
        <Route path="/gallery" element={<GalleryView />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/tokushoho" element={<Tokushoho />} />
        <Route path="/copyright" element={<Copyright />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/Faq" element={<Faq />} />
        <Route path="/admin" element={
          localStorage.getItem('isAdmin') === 'true'
            ? <AdminDashboard />
            : <Navigate to="/admin-login" />
        } />
        <Route path="/admin/users" element={
          localStorage.getItem('isAdmin') === 'true'
            ? <UserManagement />
            : <Navigate to="/admin-login" />
        } />
        <Route path="/admin/entries" element={
          localStorage.getItem('isAdmin') === 'true'
            ? <EntryManagement />
            : <Navigate to="/admin-login" />
        } />
        <Route path="/admin-login" element={<AdminLogin />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <LayoutWithWarnings />
    </Router>
  );
}

export default App;
