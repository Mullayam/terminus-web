import React from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';

interface NewFolderFormData {
  folderName: string;
}

export function NewFolderDialog() {
  const { register, handleSubmit, formState: { errors } } = useForm<NewFolderFormData>();

  const onSubmit = (data: NewFolderFormData) => {
    console.log('New folder:', data.folderName);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#1c1e26] rounded-lg shadow-xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-white font-medium">New folder</h2>           
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="text"
                  {...register('folderName', { required: true })}
                  className="w-full bg-[#13141a] text-white border border-[#2a2d37] focus:border-emerald-500 rounded-lg px-4 py-2.5 outline-none transition-colors"
                  placeholder="Foldername"
                  autoFocus
                />
                {errors.folderName && (
                  <div className="absolute -bottom-5 left-0 text-xs text-red-400">
                    This field is required
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-[#383b47] hover:bg-[#4a4d5d] text-white px-5 py-2 rounded-lg font-medium transition-colors"
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}