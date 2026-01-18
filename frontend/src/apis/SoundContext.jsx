import { createContext, useContext, useState } from 'react';
import useSound from 'use-sound';
import Music from '../assets/music.mp3';

// Use a context to allow the music to persist when navigating between different pages
const SoundContext = createContext();

export const SoundProvider = ({ children }) => {
	const [isPlaying, setIsPlaying] = useState(false);
	const [play, {pause}] = useSound(Music, { volume: 0.2, loop: true, preload: true });

	// Toggle the music to play or pause based on user selection
	const toggle = () => {
		if (isPlaying) {
			pause();
		} else {
			play();
		}
		setIsPlaying(!isPlaying);
	};

	return (
		<SoundContext.Provider value={{ isPlaying, toggle }}>
			{children}
		</SoundContext.Provider>
	);
};

export const useSoundContext = () => useContext(SoundContext);
export default SoundProvider;