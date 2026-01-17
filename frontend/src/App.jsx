import { BrowserRouter, Routes, Route } from "react-router-dom";
import './App.css';

import SoundProvider from "./apis/SoundContext.jsx"
import HomePage from "./webpages/HomePage.jsx";
import SelectionPage from "./webpages/SelectionPage.jsx";
import SinglePlayerPage from "./webpages/SinglePlayerPage.jsx";
import MultiPlayerPage from "./webpages/MultiPlayerPage.jsx";

function App() {
  return (
    <SoundProvider>
		<BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/selection" element={<SelectionPage />} />
          <Route path="/singleplayer" element={<SinglePlayerPage />} />
          <Route path="/multiplayer" element={<MultiPlayerPage />} />
        </Routes>
		</BrowserRouter>
	</SoundProvider>
  );
}

export default App;