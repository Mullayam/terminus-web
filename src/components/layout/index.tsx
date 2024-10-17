import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import EnhancedFileUploadPopup from '../FileUpload';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import PopupItem from './PopupItem';

const index = () => {
    return (
        <div>
            <div className="flex justify-between items-center mb-8">                
                <EnhancedFileUploadPopup /> {/* Replace the Button with EnhancedFileUploadPopup */}
            </div>
            <div className="bg-[#111111] rounded-lg overflow-hidden shadow-lg">
                <table className="w-full">
                    <thead className="hidden md:table-header-group">
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-800">
                            <th className="px-6 py-3 font-medium">Name</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium">Created</th>
                            <th className="px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-gray-800 md:table-row flex flex-col">
                            <td className="px-6 py-4 text-sm font-medium">Untitled</td>
                            <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-gray-800 rounded text-xs font-medium">Draft</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-400">about 2 months ago</td>
                            <td className="px-6 py-4 text-right relative">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" className="hover:bg-[#1C1C1C]">
                                            <MoreHorizontal className="text-gray-400 hover:text-white" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-40 bg-[#1C1C1C] p-2 rounded-md shadow-xl">
                                        <PopupItem label="Share" />
                                        <PopupItem label="Edit" />
                                        <PopupItem label="Delete" />
                                    </PopoverContent>
                                </Popover>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="mt-4 text-xs text-gray-400">Page 1 of 1</div>
        </div>
    )
}

export default index