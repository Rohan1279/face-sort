import * as z from "zod";

const formSchema = z.object({
  images: z
    .custom<FileList>((v) => typeof FileList !== "undefined" && v instanceof FileList, { message: "Please select at least one file." })
    .refine(
      (files) =>
        Array.from(files).every((file) => file.type.startsWith("image/")),
      "Only image files are allowed."
    ),
});

export { formSchema };
