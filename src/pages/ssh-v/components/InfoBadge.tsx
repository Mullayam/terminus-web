import React from 'react'

const InfoBadge = ({ status }: { status: string }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case "connected":
                return "bg-green-500";

            case "connecting":
                return "bg-yellow-500 animate-pulse";
            case "disconnected":
            default:
                return "bg-red-400";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "connected":
                return "Connected";
            case "disconnected":
                return "Disconnected";
            case "connecting":
                return "Connecting...";
            case "error":
                return "Error...";
            default:
                return "Unknown";
        }
    };

    return (
        <div className="text-gray-200 text-xs text-right">
            <div className="inline-flex items-center">
                <span
                    className={`size-2 inline-block rounded-full me-2 ${getStatusColor(status)}`}
                ></span>
                <span className="text-gray-200 dark:text-neutral-200">
                    {getStatusLabel(status)}
                </span>
            </div>
        </div>
    );
}

export default InfoBadge