import React, { useState } from "react";
import { Button } from "../ui/button";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";

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
  const [faces, setFaces] = useState([]);
  const { toast } = useToast();

  const handleFaceDetect = async () => {
    setIsProcessing(true);
    try {
      const response = await axios.get("http://127.0.0.1:7000/detect-faces");
      console.log("response", response);
      setIsProcessing(false);

      toast({
        description: response.data.message,
      });
    } catch (error) {
      setIsProcessing(false);

      console.error("error", error);
      //   toast({
      //     description: error.message,
      //   });
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
    </div>
  );
};

export default FaceGallery;
