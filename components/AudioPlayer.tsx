
import React, { useRef, useEffect } from 'react';

interface AudioPlayerProps {
  audioUrl: string;
  isCompleted: boolean;
  playbackRate: number;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl, isCompleted, playbackRate }) => {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate, audioUrl]);

    return (
        <div className={`w-full p-4 bg-zinc-800 rounded-lg border border-zinc-700 transition-all duration-500 ${isCompleted ? 'neon-flash' : ''}`}>
            <audio ref={audioRef} controls src={audioUrl} className="w-full mb-4" autoPlay>
                Your browser does not support the audio element.
            </audio>
            <a
                href={audioUrl}
                download="tienadobe-voice-ultimate.wav"
                className="w-full block text-center bg-gray-200 text-black font-bold py-2 px-4 rounded-lg hover:bg-white transition-colors duration-200"
            >
                Tải về file WAV
            </a>
        </div>
    );
};

export default AudioPlayer;