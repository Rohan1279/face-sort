"use client";
import FileUpload from "@/components/FileUpload";
import ImageGallery from "@/components/ImageGallery";
import { useState } from "react";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { formSchema } from "@/lib/formSchema";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);

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
  console.log("form", form.getValues());

  return (
    <div className="container">
      <FileUpload
        files={files}
        setFiles={setFiles}
        form={form}
        formSchema={formSchema}
        handleFileChange={handleFileChange}
      />
      <ImageGallery
        files={files}
        setFiles={setFiles}
        handleRemoveFile={handleRemoveFile}
      />
    </div>
  );
}
