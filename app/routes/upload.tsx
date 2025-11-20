import { useState } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import Navbar from "~/components/Navbar";
import { convertPdfToImage } from "~/lib/pdf2image";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";
import { AIResponseFormat, prepareInstructions } from "../../constants";

const Upload = () => {

  const { auth, isLoading, fs, ai, kv } = usePuterStore()
  const navigate = useNavigate()
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [file,setFile] = useState<File | null>(null)

  const handleFileSelect = (file: File | null) => {
    setFile(file)
  }


  const handleAnalyze = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string, jobTitle: string, jobDescription: string, file: File }) => {

    setIsProcessing(true);
    setStatusText("Uploading your resume...");

    try {
      console.log("Step 1: Uploading resume file...");
      const uploadedFile = await fs.upload([file])
      if (!uploadedFile) {
        setStatusText("Error: Failed to upload file.");
        return;
      }
      console.log("✓ Resume uploaded successfully");

      setStatusText("Converting to image...");
      console.log("Step 2: Converting PDF to image...");
      console.log("File details:", file.name, file.size, file.type);

      const imageResult = await convertPdfToImage(file);
      console.log("Conversion result:", imageResult);

      if (!imageResult.file) {
        const errorMessage = imageResult.error || "Unknown conversion error";
        console.error("✗ PDF conversion failed:", errorMessage);
        setStatusText(`Error: ${errorMessage}`);
        return;
      }
      console.log("✓ PDF converted to image successfully");

      setStatusText("Uploading the image...");
      console.log("Step 3: Uploading converted image...");
      const uploadedImage = await fs.upload([imageResult.file]);
      if (!uploadedImage) {
        setStatusText("Error: Failed to upload image.");
        return;
      }
      console.log("✓ Image uploaded successfully");

      // Continue with the rest of your process...
      setStatusText("Preparing data...");
      console.log("Step 4: Preparing data...");

      const uuid = generateUUID();

      const data = {
        id: uuid,
        resumePath: uploadedFile.path,
        imagePath: uploadedImage.path, // Fixed this line
        companyName,
        jobTitle,
        jobDescription,
        feedback: null
      }

      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      setStatusText("Analyzing...")
      console.log("Step 5: Starting AI analysis...");

      const feedback = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({ jobDescription, jobTitle })
      )

      if (!feedback) {
        setStatusText("Error: Failed to analyze resume");
        return;
      }

      const feedbackText = typeof feedback.message.content === "string" ? feedback.message.content : feedback.message.content[0].text

      data.feedback = JSON.parse(feedbackText)
      await kv.set(`resume:${uuid}`, JSON.stringify(data));

      setStatusText("Analysis complete, redirecting...");
      console.log("✓ Analysis complete, data:", data);

      navigate(`/resume/${uuid}`)

    } catch (error) {
      console.error("✗ Analysis error:", error);
      
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => 
  {
    e.preventDefault();
    const form = e.currentTarget.closest("form");
    if (!form) return;

    const formData = new FormData(form);

    const companyName = formData.get("company-name") as string;
    const jobTitle = formData.get("job-title") as string;
    const jobDescription = formData.get("job-description") as string;

    if (!file) return;


    handleAnalyze({companyName,jobDescription,jobTitle,file})

    
  }


  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      



      <section className="main-section">
        <Navbar />

        <div className="page-heading py-16">
          <h1>Smart feedback for your dream job</h1>
          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img src="/images/resume-scan.gif" className="w-full" alt="" />
            </>
          ) : (
              <h2>Drop your resume for an ATS score and improvement tips</h2>
          )}
          {
            !isProcessing && (
              <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                <div className="form-div">
                  <label htmlFor="company-name">Company Name
                  </label>
                  <input type="text" id="company-name" name="company-name" placeholder="Company Name" />
                </div>

                <div className="form-div">
                  <label htmlFor="job-title">Job Title
                  </label>
                  <input type="text" id="job-title" name="job-title" placeholder="Job Title" />
                </div>

                <div className="form-div">
                  <label htmlFor="job-description">Job Description
                  </label>
                  <textarea rows={5} id="job-description" name="job-description" placeholder="Job Description" />
                </div>


                <div className="form-div">
                  <label htmlFor="uploader">Uploader Resume
                  </label>
                  <FileUploader onFileSelect={handleFileSelect}/>
                </div>

                <button className="primary-button" type="submit">
                  Analyze Resume
                </button>

                
             

              </form>
            )
          }

        </div>
      </section>
      </main>
  );
}

export default Upload;
