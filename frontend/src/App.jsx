import { BrowserRouter, Routes, Route } from "react-router-dom";
import './App.css';

import MenuPage from "./webpages/MenuPage.jsx";
import SinglePlayerPage from "./webpages/SinglePlayerPage.jsx";
import MultiPlayerPage from "./webpages/MultiPlayerPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MenuPage />} />
		<Route path="/singleplayer" element={<SinglePlayerPage />} />
		<Route path="/multiplayer" element={<MultiPlayerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;