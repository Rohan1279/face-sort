"use client";
import { useState } from "react";
import { Input } from "../ui/input";
import axios from "axios";
import { Progress } from "../ui/progress";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn } from "react-hook-form";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { formSchema } from "@/lib/formSchema";

interface FileUploadProps {
  files: File[];
  setFiles: (files: File[]) => void;
  formSchema: z.ZodObject<any, any>;
  form: UseFormReturn<z.infer<typeof formSchema>>;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  files,
  setFiles,
  form,
  formSchema,
  handleFileChange,
}) => {
  const { toast } = useToast();

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLInputElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (!file.type.includes("image")) {
      toast({
        description: "Only image files are allowed.",
      });
      form.setError("images", {
        message: "Only image files are allowed.",
      });
    }
  };
  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsUploading(true);
    setUploadProgress(0);
    if (values) {
      // Create a new FormData instance and append each file to it as a key-value pair
      const formData = new FormData();
      for (let i = 0; i < values.images.length; i++) {
        formData.append("files", values.images[i]);
      }
      try {
        const response = await axios.put(
          "http://127.0.0.1:7000/upload",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total!
              );
              setUploadProgress(percentCompleted);
            },
          }
        );
        if (response.status === 200) {
          console.log(response.data);
          setIsUploading(false);
          toast({
            description: "Files uploaded successfully!",
          });
        }
      } catch (error) {
        console.error(error);
        setIsUploading(false);
        toast({
          description: "An error occurred while uploading files.",
        });
      }
    }
  };

  return (
    <div className="">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Upload Files</FormLabel>
                <FormControl>
                  <Input
                    draggable
                    type="file"
                    multiple
                    accept="image/*"
                    disabled={isUploading}
                    onChange={(e) => {
                      field.onChange(e.target.files);
                      handleFileChange(e);
                    }}
                    onDrop={(e) => handleDrop(e)}
                  />
                </FormControl>
                <FormDescription>
                  Select one or more image files to upload.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-sm text-gray-500">
                {uploadProgress}% uploaded
              </p>
            </div>
          )}
          <Button type="submit" disabled={isUploading}>
            {isUploading ? "Uploading..." : "Upload Files"}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default FileUpload;
