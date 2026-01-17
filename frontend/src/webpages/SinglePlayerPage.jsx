import './SinglePlayerPage.css';
import CharacterStage from "./CharacterStage";

export default function SinglePlayerPage() {
  return (
    <div className="singleplayer-page">
      <h1>Dress to Impress</h1>
      <CharacterStage />
      <div className="ui-overlay">
        {/* Your Tinder cards will go here later */}
        <p>Swipe left/right to change clothes</p>
      </div>
    </div>
  );
}