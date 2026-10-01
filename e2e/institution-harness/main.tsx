import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Instituciones from '@/pages/Instituciones';
import { AvisosBell } from '@/components/notifications/AvisosBell';
import '@/index.css';
createRoot(document.getElementById('root')!).render(<BrowserRouter><div className="mx-auto max-w-5xl p-4"><header className="flex justify-end"><AvisosBell /></header><Routes><Route path="/instituciones" element={<Instituciones />} /></Routes></div></BrowserRouter>);
