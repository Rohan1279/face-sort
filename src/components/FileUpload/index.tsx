"use client";
import { useState } from "react";
import { Input } from "../ui/input";
import axios from "axios";
import { Progress } from "../ui/progress";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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

const FileUpload: React.FC = () => {
  const { toast } = useToast();

  const formSchema = z.object({
    images: z
      .instanceof(FileList, { message: "Please select at least one file." })
      .refine((files) => files.length > 0, "At least one file is required."),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      images: undefined,
    },
  });

  // const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  // const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   setSelectedFiles(event.target.files);
  // };

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsUploading(true);
    setUploadProgress(0);
    if (values) {
      console.log(values);
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
      }
    }
  };

  return (
    <div className="upload-container">
      {/* <Input type="file" multiple onChange={handleFileChange} />
      <Progress value={uploadProgress} />
      <button onClick={handleSubmit}>Start Face Recognition</button> */}
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
                    type="file"
                    multiple
                    disabled={isUploading}
                    onChange={(e) => field.onChange(e.target.files)}
                  />
                </FormControl>
                <FormDescription>
                  Select one or more files to upload.
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
