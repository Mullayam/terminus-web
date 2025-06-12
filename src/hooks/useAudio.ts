import { useRef, useEffect } from 'react';

const useAudio = (src: string) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio(src);

        return () => {
            // Clean up on unmount
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
                audioRef.current = null;
            }
        };
    }, [src]);

    const play = () => {
        audioRef.current?.play();
    };

    const pause = () => {
        audioRef.current?.pause();
    };

    const stop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const setVolume = (volume: number) => {
        if (audioRef.current) {
            audioRef.current.volume = Math.min(Math.max(volume, 0), 1);
        }
    };

    return {
        play,
        pause,
        stop,
        setVolume,
        audio: audioRef.current,
    };
};

export default useAudio;