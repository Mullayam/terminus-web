const URL = import.meta.env.VITE_APP_ENV === "PROD"? import.meta.env.VITE_API_URL : 'http://localhost:7145';
const config = {
    API_URL: URL,
    APP_ENV: import.meta.env.VITE_APP_ENV,
}

export const __config = Object.freeze(config)