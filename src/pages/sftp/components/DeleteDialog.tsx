import React from 'react';

interface DeleteFolderDialogProps {
  folderName: string;
  type: string;
  onDelete: () => void;
}

export function DeleteFolderDialog({ folderName, onDelete, type }: DeleteFolderDialogProps) {
  return (
    <div className="p-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-white font-medium">Do you want to delete {folderName} {type === "d" ? "folder" : "file"}?</h2>
          </div>
          <div className="flex justify-end space-x-3">

            <button
              onClick={onDelete}
              className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
    </div>
  );
}