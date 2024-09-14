"use client";
import { useState } from "react";
import { Input } from "../ui/input";
import axios from "axios";
import Link from "next/link";

const FileUpload: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleSubmit = async () => {
    if (selectedFiles) {
      // Create a new FormData instance and append each file to it as a key-value pair
      const formData = new FormData();
      Array.from(selectedFiles).forEach((file) => {
        formData.append("files", file);
      });

      try {
        const response = await axios.post(
          "http://127.0.0.1:7000/upload",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        console.log(response);
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <div className="upload-container">
      <Input type="file" multiple onChange={handleFileChange} />
      <button onClick={handleSubmit}>Start Face Recognition</button>
      <Link href="/api/python">
        <code className="font-mono font-bold">api/index.py</code>
      </Link>
    </div>
  );
};
export default FileUpload;
