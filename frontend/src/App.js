import React from "react";
import "@/App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Workspace from "./pages/Workspace";

export default function App() {
  return (
    <div className="App">
      <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#141923", border: "1px solid #283348", color: "#f1f5f9", fontFamily: "JetBrains Mono, monospace" } }} />
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<Workspace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
