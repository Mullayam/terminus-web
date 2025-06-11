import React from "react";
import { Loader2 } from "lucide-react"; // or use any icon/spinner you prefer

const FullScreenLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="flex flex-col items-center space-y-2">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
        <p className="text-white text-sm">Loading...</p>
      </div>
    </div>
  );
};

export default FullScreenLoader;
