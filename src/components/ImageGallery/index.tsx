import Image from "next/image";
import React from "react";
interface ImageGalleryProps {
  files: File[];
  setFiles: (files: File[]) => void;
  handleRemoveFile: (index: number) => void;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  files,
  setFiles,
  handleRemoveFile,
}) => {
  return (
    <div className="grid grid-cols-4 gap-2">
      {files.map((file, index) => (
        <div key={index}>
          <Image
            src={URL.createObjectURL(file)}
            alt={`file-preview-${index}`}
            className="size-40 relative"
            width={400}
            height={400}
          />
          <button
            className=""
            onClick={() => {
              handleRemoveFile(index);
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

export default ImageGallery;
