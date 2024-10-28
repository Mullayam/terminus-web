/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { X, Upload, File, Check } from 'lucide-react';

export default function EnhancedFileUploadPopup({ children }: any) {
  const [files, setFiles] = useState<Array<File & { progress?: number; uploaded?: boolean }>>([]);
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prevFiles) => [
      ...prevFiles,
      ...acceptedFiles.map((file) => {

        return {
          ...file,
          progress: 0,
          uploaded: false,
        };
      }),
    ]);
    setIsUploading(true);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const removeFile = (file: File) => {
    setFiles((prevFiles) => prevFiles.filter((f) => f !== file));
  };

  useEffect(() => {
    if (isUploading) {
      const interval = setInterval(() => {
        setFiles((prevFiles) =>
          prevFiles.map((file) => {
            if (file.progress! < 100) {
              return { ...file, progress: Math.min(file.progress! + 10, 100) };
            }
            return { ...file, uploaded: true };
          })
        );
      }, 500);

      return () => clearInterval(interval);
    }
  }, [isUploading]);

  useEffect(() => {
    if (files.every((file) => file.uploaded)) {
      setIsUploading(false);
    }
  }, [files]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Upload Files</DialogTitle>
        </DialogHeader>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
          <div
            {...getRootProps()}
            className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300'
              }`}
            style={{
              background: isDragActive ? 'linear-gradient(145deg, rgba(59,130,246,0.1) 0%, rgba(147,51,234,0.1) 100%)' : 'white',
              borderImage: isDragActive ? 'linear-gradient(145deg, #3b82f6 0%, #9333ea 100%) 1' : 'none',
            }}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500">Drag &apos;n&apos; drop some files here, or click to select files</p>
          </div>
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 overflow-hidden"
              >
                <h4 className="text-sm font-medium text-gray-200 mb-2">Uploaded files</h4>
                <ul className="space-y-2">
                  {files.map((file, index) => {
                    console.log('Rendering file:', file);
                    return (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <File className="h-5 w-5 text-primary" />
                          <span className="text-sm">{file.name || (file as any).path || 'Unnamed file'}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {file.uploaded ? <Check className="h-5 w-5 text-green-500" /> : <Progress value={file.progress} className="w-20" />}
                          <Button variant="ghost" size="sm" onClick={() => removeFile(file)} className="text-red-500 hover:text-red-700">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-6">
          <Button onClick={() => setOpen(false)} className="w-full bg-primary hover:bg-primary/90">
            {isUploading ? 'Uploading...' : 'Done'}
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}