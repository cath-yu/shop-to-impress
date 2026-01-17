// EXTERNAL
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import useSound from 'use-sound';

// CSS
import './MenuPage.css';

// COMPONENTS AND ASSETS
import Button from '../components/Button';
import Closet from '../assets/closet.jpg';
import Music from '../assets/music.mp3';


export default function MenuPage() {
    const navigate = useNavigate();
    const [play, { stop }] = useSound(Music, { volume: 0.2, loop: true });

    // Play music on load and clean-up 
    // (although the user still needs to interact with the website before it plays)
    useEffect(() => {
        play();
        
        return () => stop();
    }, [play, stop]);

    // Left doors for singleplayer mode
    const handleSingleClick = () => {
        handleDoor("single")

        setTimeout(() => {
            navigate("/singleplayer");
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
        slideDoor.classList.toggle('is-visible');
    }

    return (
        <div className="menu-page">
            <div className="menu-page-background">
                <div className="menu-page-wardrobe">
                    <div className="menu-page-wardrobe-ls">
                        <img className="menu-page-wardrobe-left" src={Closet}></img>
                        <div id="single" className="menu-page-single-door">
                            <div className="menu-page-single-door-knob"></div>
                        </div>
                    </div>

                    <div className="menu-page-wardrobe-rs">
                        <img className="menu-page-wardrobe-right" src={Closet}></img>
                        <div id="multi" className="menu-page-multi-door">
                            <div className="menu-page-multi-door-knob"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="menu-page-content">
                <div className="menu-page-title">
                    <h2>SHOP TO</h2>
                    <h1>IMPRESS!</h1>
                </div>

                <div className="menu-page-buttons">
                    <Button style="primary" onClick={handleSingleClick}>SINGLEPLAYER</Button>
                    <Button style="primary" onClick={handleMultiClick}>MULTIPLAYER</Button>
                    <Button style="secondary" disabled={true}>SETTINGS</Button>
                </div>
            </div>           
        </div>
    )
}