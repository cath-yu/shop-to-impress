import { BrowserRouter, Routes, Route } from "react-router-dom";
import './App.css';

import MenuPage from "./webpages/MenuPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MenuPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;