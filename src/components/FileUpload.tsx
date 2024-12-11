/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Upload, File, Folder } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { extractPath } from '@/lib/utils';
interface FileWithPath extends File {
  path?: string
}
export default function EnhancedFileUploadPopup({ open, startUpload, setOpen, files, setFiles, isUploading, setIsUploading }: {
  open: boolean, setOpen: React.Dispatch<React.SetStateAction<boolean>>
  files: Array<File & { path?: string }>,
  setFiles: React.Dispatch<React.SetStateAction<Array<File & { path?: string }>>>,
  isUploading: boolean,
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>
  startUpload: (file: any) => void
}) {

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prevFiles) => [
      ...prevFiles,
      ...acceptedFiles,
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  })


  const removeFile = (file: File) => {
    setFiles((prevFiles) => prevFiles.filter((f) => f !== file));
  };
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const fileArray = Array.from(files) as FileWithPath[]
      setFiles(prevItems => [...prevItems, ...fileArray])
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Upload Files</DialogTitle>
        </DialogHeader>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          <div
            {...getRootProps()}
            className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all  ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300'
              }`}
            style={{
              background: isDragActive ? 'linear-gradient(145deg, rgba(59,130,246,0.1) 0%, rgba(147,51,234,0.1) 100%)' : 'white',
              borderImage: isDragActive ? 'linear-gradient(145deg, #3b82f6 0%, #9333ea 100%) 1' : 'none',
            }}
          >
            <input {...getInputProps()}
              multiple />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Drag &apos;n&apos; drop some files/folder here </p>
            <Button
              variant="ghost"
              className="bg-primary hover:bg-primary/90"
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              Select Files
            </Button>
            <input
              type="file"
              id="fileInput"
              className="hidden"
              onChange={handleFileInputChange}
              {...({ webkitdirectory: true } as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
              multiple
            />
          </div>
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 overflow-hidden"
              >
                <div className='flex justify-between items-center'>
                  <h4 className="text-sm font-medium text-gray-200 mb-2">{files.length} Uploaded files </h4>
                  <h4 className="text-sm font-medium text-gray-200 mb-2 cursor-pointer" onClick={() => setFiles([])}>Remove All </h4>
                </div>
                <ScrollArea className='h-96'>
                  <ul className="space-y-2">
                    {files.map((file, index) => {

                      return (
                        <motion.li
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="rounded-lg p-3 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            {file.path ? <Folder className="w-4 h-4 mr-2" /> : <File className="w-4 h-4 mr-2" />}
                            <span className="text-sm">{file.name || (file as any).path || 'Unnamed file'}</span>
                          </div>
                          <div className="flex items-center space-x-2">

                            <Button variant="ghost" size="sm" onClick={() => removeFile(file)} className="text-red-500 hover:text-red-700">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6">
          <Button onClick={() => {
            setIsUploading(true);
            startUpload(files);
          }} className="w-full bg-primary hover:bg-primary/90">
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}