import { useRef } from "react";


type UseIdleReconnectOptions = {
    idleTimeInMs?: number;
};

export const useIdleReconnect = ({ idleTimeInMs = 30 * 60 * 1000 }: UseIdleReconnectOptions = {}) => {
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startTracking = (onIdle: () => void) => {
        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                onIdle()
            }, idleTimeInMs);
        };

        const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];

        events.forEach(event => window.addEventListener(event, resetTimer));
        resetTimer();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    };

    return startTracking;
};
