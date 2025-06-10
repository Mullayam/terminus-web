import { useRef, useCallback } from 'react';

export enum CustomEventKey {
    NEW_SSH_CLIENT = 'NEW_SSH_CLIENT',

}

type Callback<T> = (data: T) => void;

const debounce = (fn: Function, delay: number) => {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: any[]) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

/**
 * Custom event hook with memoized handlers to prevent recreations on every render.
 */
export function useCustomEvent<T = any>(eventKey: keyof typeof CustomEventKey, handler?: Callback<T>) {
    const onceFired = useRef(false);

    // Emit event, memoized so `emit` has stable reference
    const emit = useCallback((payload?: T) => {
        console.log('Received');
        window.dispatchEvent(new CustomEvent(CustomEventKey[eventKey], { detail: payload }));
    }, [eventKey]);

    // Emit only once, memoized and uses latest `emit`
    const emitOnce = useCallback((payload?: T) => {
        if (!onceFired.current) {
            emit(payload);
            onceFired.current = true;
        }
    }, [emit]);

    // Debounced emit: returns a stable debounced function for the given delay
    const emitDebounce = useCallback((delay: number) => {
        const debounced = debounce((payload: T) => {
            emit(payload);
        }, delay);
        return debounced;
    }, [emit]);

    // Listen to event, returns unsubscribe function
    const listen = useCallback((handler: Callback<T>) => {
        const wrapper = (e: Event) => handler((e as CustomEvent<T>).detail);
        window.addEventListener(eventKey, wrapper);
        return () => window.removeEventListener(eventKey, wrapper);
    }, [eventKey]);

    // Listen once to event, auto removes listener after first call
    const listenOnce = useCallback((handler: Callback<T>) => {
        const wrapper = (e: Event) => {
            handler((e as CustomEvent<T>).detail);
            window.removeEventListener(eventKey, wrapper);
        };
        window.addEventListener(eventKey, wrapper);
    }, [eventKey]);

    return {
        emit,
        emitOnce,
        emitDebounce,
        listen,
        listenOnce,
    };
}