import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

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


function App() {   // ← これが必要！！
  return (
    <Router>
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
        
        {/* 管理ページ */}
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
    </Router>
  );
}

export default App;  // ← 最後に必ずこれも！
