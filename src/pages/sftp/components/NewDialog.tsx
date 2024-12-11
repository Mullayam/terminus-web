import { useForm } from 'react-hook-form';
import { SFTP_FILES_LIST } from './interface';
import { FileOperations } from './FileList';

interface NewFolderFormData {
  folderName: string;
}

export function NewFolderDialog({ data, type, onClick }: { data: SFTP_FILES_LIST, type: FileOperations, onClick: (fullPath: string, type: FileOperations, newPath?: string) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<NewFolderFormData>();

  const onSubmit = (input: NewFolderFormData) => {
    if (type === "rename") {
      onClick(data.name, type, input.folderName)
      return
    }
    if (type === "file") {
      onClick(input.folderName, type)
      return
    }
    if (type === "folder") {
      onClick(input.folderName, type)
      return
    }
    if (type === "move") {
      onClick(data.name, type, input.folderName)
      return
    }

  };

  return (
    <div className=" flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#1c1e26] rounded-lg animate-in slide-in-from-bottom-4 duration-300">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl text-white font-medium">New {type}</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <div className="relative">
                {type === "rename" &&
                  (
                    <div className='my-2'>
                      <input
                        type="text"
                        className="w-full bg-[#13141a] text-white border border-[#2a2d37] focus:border-emerald-500 rounded-lg px-4 py-2.5 outline-none transition-colors"
                        value={data.name}
                        disabled
                      />
                    </div>)}

                <input
                  type="text"
                  {...register('folderName', { required: true })}
                  className="w-full bg-[#13141a] text-white border border-[#2a2d37] focus:border-emerald-500 rounded-lg px-4 py-2.5 outline-none transition-colors"
                  placeholder={type}
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