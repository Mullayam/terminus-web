import { deleteDB } from 'idb';
import { useNavigate } from 'react-router-dom';
import { HostsObject } from '..';
import { Trash } from 'lucide-react';

interface HostCardProps {
    info: HostsObject
}

export function HostCard({ info }: HostCardProps) {
    const navigate = useNavigate();
    return (
        <div className="bg-slate-800 rounded-lg p-4 flex items-center gap-4 hover:bg-slate-700 transition-colors cursor-pointer">
            <div onClick={() => navigate('/ssh/connect', {
                state: info
            })} className="bg-orange-500 w-12 h-12 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
            </div>
            <div className="flex-grow" onClick={() => navigate('/ssh/connect', {
                state: info
            })}>
                <h3 className="text-white font-medium">{info.localName || info.host}</h3>
                <p className="text-slate-400 text-sm">ssh,{info.username}</p>
            </div>
            <button onClick={() => deleteDB(info.host)} className="text-slate-400 hover:text-white transition-colors">
                <Trash />
            </button>
        </div>
    );
}