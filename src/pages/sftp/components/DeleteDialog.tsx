import React from 'react';
import { useContextModalClose } from '@/components/ui/context-modal';
import { useToast } from '@/hooks/use-toast';

interface DeleteFolderDialogProps {
  folderName: string;
  type: string;
  onDelete: () => void;
}

export function DeleteFolderDialog({ folderName, onDelete, type }: DeleteFolderDialogProps) {
  const closeModal = useContextModalClose();
  const { toast } = useToast();

  const handleDelete = () => {
    onDelete();
    toast({
      title: "Deleted",
      description: `${type === "d" ? "Folder" : "File"} "${folderName}" deleted`,
      duration: 2000,
    });
    closeModal?.();
  };

  return (
    <div className="p-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-white font-medium">Do you want to delete {folderName} {type === "d" ? "folder" : "file"}?</h2>
          </div>
          <div className="flex justify-end space-x-3">

            <button
              onClick={handleDelete}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
    </div>
  );
}