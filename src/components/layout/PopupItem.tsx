
const PopupItem = ({ label }: { label: string }) => {
    return <div className="px-3 py-2 text-sm text-white hover:bg-[#2C2C2C] cursor-pointer rounded">{label}</div>;
}

export default PopupItem