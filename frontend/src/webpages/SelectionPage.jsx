// EXTERNAL
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

// CSS
import './SelectionPage.css';

// COMPONENTS AND ASSETS
import Button from "../components/Button";
import CheckboxList from "../components/CheckboxList";
import Hanger from '../assets/hanger.png';

export default function SelectionPage() {
    const navigate = useNavigate();
    const [selected, setSelected] = useState([]);
    const tones = ["Warm", "Neutral", "Cool"]
    const palettes = ["Monochromatic", "Complementary", "Analagous"]
    // const seasons = ["Winter", "Spring", "Summer", "Fall"]
    const themes = ["Casual", "Streetwear", "Academia"]

    useEffect(() => {
    const slideHanger = document.getElementById("hanger");
        slideHanger.classList.add('slide-in');
    }, []);

    const handleSelection = (selection, isChecked) => {
        if (isChecked) {
            setSelected((prev) => 
                [...prev,selection]
            );
        } else {
            setSelected((prev) => 
                prev.filter((option) => 
                    option !== selection
                )
            );
        }
    }

    const handleClick = () => {

        navigate("/singleplayer");
    }

    return (
        <div className="selection-page">
            <div className="selection-page-background">
                <div className="selection-page-rod"></div>
                <img id="hanger" className="selection-page-hanger" src={Hanger}></img>
            </div>

            <div className="selection-page-content">
                <div className="selection-page-title">
                    <h2>LOOKING FOR</h2>
                    <h1>INSPIRATION?</h1>
                    <p>Choose one to three options!</p>
                </div>

                <div className="selection-page-options">
                    <div className="selection-page-options-list">
                        <p>Tone</p>
                        <CheckboxList data={tones} selected={selected} onItemSelect={handleSelection}></CheckboxList>
                    </div>

                    <div className="selection-page-options-list">
                        <p>Colour Combo</p>
                        <CheckboxList data={palettes} selected={selected} onItemSelect={handleSelection}></CheckboxList>
                    </div>

                    {/* <div className="selection-page-options-list">
                        <p>Season</p>
                        <CheckboxList data={seasons} selected={selected} onItemSelect={handleSelection}></CheckboxList>
                    </div> */}

                    <div className="selection-page-options-list">
                        <p>Theme</p>
                        <CheckboxList data={themes} selected={selected} onItemSelect={handleSelection}></CheckboxList>
                    </div>
                </div>

                <div className="selection-page-buttons">
                    <Button style="primary" disabled={selected.length < 1} onClick={handleClick}>IMPRESS</Button>
                </div>
            </div>
            
        </div>
    )
}