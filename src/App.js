import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import '@fontsource/roboto';
import 'reactreejs/style.css';
import './App.css';
import { DataProvider } from './DataContext';
import TreePage from './TreePage';
import BrowserPage from './BrowserPage';
import BlastPage from './BlastPage';

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter basename={process.env.PUBLIC_URL}>
        <Routes>
          <Route path="/" element={<TreePage />} />
          <Route path="/browser" element={<BrowserPage />} />
          <Route path="/blast" element={<BlastPage />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
