"use client";
import FileUpload from "@/components/FileUpload";
import ImageGallery from "@/components/ImageGallery";
import { useState } from "react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { formSchema } from "@/lib/formSchema";
import FaceGallery from "@/components/FaceGallery";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      images: undefined,
    },
  });
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setFiles(newFiles);
      form.setValue("images", event.target.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    const dataTransfer = new DataTransfer();
    newFiles.forEach((file) => dataTransfer.items.add(file));
    form.setValue("images", dataTransfer.files);
  };

  return (
    <div className="container grid grid-cols-2 gap-x-5 mx-auto min-h-screen">
      <div className="col-span-1 border overflow-y-scroll max-h-screen p-5">
        <FileUpload
          files={files}
          setFiles={setFiles}
          form={form}
          formSchema={formSchema}
          handleFileChange={handleFileChange}
          isUploading={isUploading}
          setIsUploading={setIsUploading}
          isProcessing={isProcessing}
        />
        <ImageGallery
          files={files}
          setFiles={setFiles}
          handleRemoveFile={handleRemoveFile}
        />
      </div>
      <div className="col-span-1 border p-5">
        <FaceGallery
          isUploading={isUploading}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      </div>
    </div>
  );
}
