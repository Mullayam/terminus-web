import React from "react";

interface ContextMenuProps {
    options: { label: string; onClick: () => void }[];
    position: { x: number; y: number };
    onClose: () => void;
}

export function ContextMenu({
    options = [],
    position = { x: 0, y: 0 },
    onClose = () => { },
}: ContextMenuProps) {
    return (
        <ul
            className="absolute bg-gray-800 text-white p-2 rounded-md shadow-lg z-50"
            style={{
                top: `${position.y}px`,
                left: `${position.x}px`,
            }}
            onClick={onClose}
        >
            {options.map((option, index) => (
                <li
                    key={index}
                    onClick={option.onClick}
                    className="px-2 py-2 w-48 cursor-pointer hover:bg-gray-600"
                >
                    {option.label}
                </li>
            ))}
        </ul>
    );
}
