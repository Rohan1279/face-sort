"use client";
import FileUpload from "@/components/legacy/FileUpload";
import ImageGallery from "@/components/legacy/ImageGallery";
import { useEffect, useState } from "react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { formSchema } from "@/components/legacy/formSchema";
import FaceGallery from "@/components/legacy/FaceGallery";
import { Toaster } from "@/components/legacy/ui/toaster";

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
  // useEffect(() => {
  //   const images = form.getValues("images");
  //   if (!images || images.length < 1) {
  //     setIsProcessing(true);
  //   }
  //   console.log("files", files.length);
  // }, [form.getValues("images")]);

  return (
    <>
    <p className="container mx-auto p-2 text-sm text-muted-foreground">
      Legacy version: needs the old FastAPI backend (fast-api-face-recognition) running on 127.0.0.1:7000.
    </p>
    <div className="container grid grid-cols-2 gap-x-5 mx-auto min-h-screen">
      <div className="col-span-1 border overflow-y-auto max-h-screen p-5">
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
      <div className="col-span-1 border p-5 overflow-y-auto max-h-screen">
        <FaceGallery
          isUploading={isUploading}
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
        />
      </div>
    </div>
    <Toaster />
    </>
  );
}
