import { useState, useEffect } from "react";
import { FileText, Image, ExternalLink } from "lucide-react";
import api from "@/lib/axios";

interface AttachmentThumbnailProps {
  filePath: string;
  isImage: boolean;
  onClick?: (url: string) => void;
}

export function AttachmentThumbnail({
  filePath,
  isImage,
  onClick,
}: AttachmentThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      api
        .get("/storage/signed-url", {
          params: { path: filePath, bucket: "invoices" },
        })
        .then((res) => setUrl(res.data.data.url))
        .catch(() => {});
    }
  }, [filePath, isImage]);

  if (!isImage) {
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
        <FileText className="w-6 h-6 text-red-500" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <Image className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  return (
    <div
      className="group relative cursor-zoom-in"
      onClick={() => url && onClick?.(url)}
    >
      <img
        src={url}
        alt="thumbnail"
        className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
        <ExternalLink className="w-3 h-3 text-white" />
      </div>
    </div>
  );
}
