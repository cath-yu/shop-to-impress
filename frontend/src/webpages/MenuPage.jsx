import { useNavigate } from "react-router-dom";
import './MenuPage.css';
import Button from '../components/Button';

export default function MenuPage() {
    const navigate = useNavigate();

    return (
        <div className="menu-page">
            <div className="menu-page-title">
                <h2>SHOP TO</h2>
                <h1>IMPRESS</h1>
            </div>

            <div className="menu-page-buttons">
                <Button style="primary" onClick={() => navigate("/singleplayer")}>SINGLEPLAYER</Button>
                <Button style="primary" onClick={() => navigate("/multiplayer")}>MULTIPLAYER</Button>
            </div>
        </div>
    )
}