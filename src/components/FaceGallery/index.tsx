import React, { useState } from "react";
import { Button } from "../ui/button";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

interface FaceGalleryProps {
  isUploading: boolean;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

const FaceGallery: React.FC<FaceGalleryProps> = ({
  isUploading,
  isProcessing,
  setIsProcessing,
}) => {
  const [faces, setFaces] = useState<string[]>([]);
  const { toast } = useToast();

  const handleFaceDetect = async () => {
    setIsProcessing(true);
    try {
      const response = await axios.get("http://127.0.0.1:7000/detect-faces");
      console.log("response", response);
      setIsProcessing(false);
      setFaces(response.data.face_urls);
      toast({
        description: response.data.message,
      });
    } catch (error) {
      setIsProcessing(false);

      console.error("error", error);
      if (error instanceof Error) {
        toast({
          description: error.message,
        });
      } else {
        toast({
          description: "An unknown error occurred",
        });
      }
    }
  };
  return (
    <div>
      <Button
        onClick={handleFaceDetect}
        type="button"
        disabled={isUploading || isProcessing}
      >
        {isProcessing && "Processing Images..."}
        {!isUploading && !isProcessing && "Detect Faces"}
      </Button>
      <div className="grid  grid-cols-4 gap-2">
        {faces.map((face, index) => (
          <div key={index}>
            <Image
              src={`http://127.0.0.1:7000${face}`}
              alt={`face-${index}`}
              className="w-32 h-32 object-cover"
              width={800}
              height={800}
            />
            <span>{face.split("/").pop()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FaceGallery;
