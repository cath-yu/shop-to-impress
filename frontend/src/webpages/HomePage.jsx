// EXTERNAL
import { useNavigate } from "react-router-dom";

// CSS
import './HomePage.css';

// COMPONENTS AND ASSETS
import { useSoundContext } from '../apis/SoundContext';
import Button from '../components/Button';
import Closet from '../assets/closet.jpg';

export default function HomePage() {
    const navigate = useNavigate();
    const { isPlaying, toggle } = useSoundContext();

    // Left doors for singleplayer mode
    const handleSingleClick = () => {
        handleDoor("single")

        setTimeout(() => {
            navigate("/selection");
        }, 1000);
    }

    // Right doors for multiplayer mode
    const handleMultiClick = () => {
        handleDoor("multi")

        setTimeout(() => {
            navigate("/multiplayer");
        }, 1000);
    }

    // Move door by toggling CSS
    const handleDoor = (value) => {
        const slideDoor = document.getElementById(value);
        slideDoor.classList.toggle('open');
    }

    return (
        <div className="home-page">
            <div className="home-page-background">
                <div className="home-page-wardrobe">
                    <div className="home-page-wardrobe-ls">
                        <img className="home-page-wardrobe-left" src={Closet}></img>
                        <div id="single" className="home-page-single-door">
                            <div className="home-page-single-door-knob"></div>
                        </div>
                    </div>

                    <div className="home-page-wardrobe-rs">
                        <img className="home-page-wardrobe-right" src={Closet}></img>
                        <div id="multi" className="home-page-multi-door">
                            <div className="home-page-multi-door-knob"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="home-page-content">
                <div className="home-page-title">
                    <h2>SHOP TO</h2>
                    <h1>IMPRESS!</h1>
                </div>

                <div className="home-page-buttons">
                    <Button style="primary" onClick={handleSingleClick}>SINGLEPLAYER</Button>
                    <Button style="primary" onClick={handleMultiClick}>MULTIPLAYER</Button>
                    <Button style="secondary" onClick={toggle}>{isPlaying ? 'SPEAKER OFF' : 'SPEAKER ON'}</Button>
                </div>
            </div>           
        </div>
    )
}