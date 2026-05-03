import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import { apiCall } from "../services/apiClient";
import {
  Mic,
  Camera,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader,
  Info,
} from "lucide-react";

interface MediaUploadWidgetProps {
  onTextExtracted: (text: string, mediaType: string, language: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

interface ExtractedMedia {
  text: string;
  mediaType: "audio" | "image" | "pdf";
  fileName: string;
  confidence: number;
  language: string;
}

interface ProcessingError {
  title: string;
  message: string;
  details?: string;
  suggestion?: string;
}

const MediaUploadWidget: React.FC<MediaUploadWidgetProps> = ({
  onTextExtracted,
  onError,
  disabled = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<ExtractedMedia | null>(
    null,
  );
  const [processingStatus, setProcessingStatus] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<"ur" | "en">("en");
  const [processingError, setProcessingError] =
    useState<ProcessingError | null>(null);

  // Handle file drop/selection
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      await processMediaFile(file);
    },
    [selectedLanguage],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "audio/*": [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"],
      "application/pdf": [".pdf"],
    },
    disabled: isProcessing || disabled,
    multiple: false,
  });

  const processMediaFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingStatus(`Processing ${file.name}...`);
    setExtractedText(null);
    setProcessingError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", selectedLanguage);

      // Determine endpoint based on file type
      const isAudio = file.type.startsWith("audio/");
      const endpoint = isAudio ? "/api/transcribe" : "/api/extract-text";
      const fieldName = isAudio ? "audio" : "file";

      // Recreate FormData with correct field name
      const correctFormData = new FormData();
      correctFormData.append(fieldName, file);
      correctFormData.append("language", selectedLanguage);

      setProcessingStatus(`Uploading ${file.name}...`);

      const response = await apiCall(endpoint, {
        method: "POST",
        body: correctFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorTitle = errorData.error || "Upload Failed";
        const errorMessage =
          errorData.message || `Upload failed with status ${response.status}`;

        setProcessingError({
          title: errorTitle,
          message: errorMessage,
          details: errorData.details,
          suggestion: `Try a different file or check that your ${file.type.includes("audio") ? "audio" : "image/PDF"} file is not corrupted.`,
        });
        onError(errorTitle);
        return;
      }

      const result = await response.json();

      if (!result.text || result.text.trim().length === 0) {
        setProcessingError({
          title: "No Text Found",
          message:
            "The file appears to be empty or could not be processed properly.",
          suggestion: "Please check your file and try again.",
        });
        onError("No text extracted");
        return;
      }

      // Determine media type
      let mediaType: "audio" | "image" | "pdf" = "audio";
      if (file.type.startsWith("image/")) {
        mediaType = "image";
      } else if (file.type.includes("pdf")) {
        mediaType = "pdf";
      }

      setProcessingStatus(
        `✓ Extracted ${result.text.length} characters from ${mediaType}`,
      );

      const extracted: ExtractedMedia = {
        text: result.text,
        mediaType: mediaType,
        fileName: file.name,
        confidence: result.confidence || 0.9,
        language: result.language || selectedLanguage,
      };

      setExtractedText(extracted);

      // Notify parent component
      setTimeout(() => {
        onTextExtracted(result.text, mediaType, result.language);
      }, 1000);
    } catch (error: any) {
      const errorMsg = error.message || "Failed to process media file";
      setProcessingError({
        title: "Processing Error",
        message: errorMsg,
        suggestion: "Please check your internet connection and try again.",
      });
      onError(errorMsg);
      console.error("Media processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearExtracted = () => {
    setExtractedText(null);
    setProcessingStatus("");
    setProcessingError(null);
  };

  // Icon for media type
  const getMediaIcon = (type: "audio" | "image" | "pdf") => {
    switch (type) {
      case "audio":
        return <Mic className="w-8 h-8" />;
      case "image":
        return <Camera className="w-8 h-8" />;
      case "pdf":
        return <FileText className="w-8 h-8" />;
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {/* Language Selector */}
      <div className="flex gap-2 items-center">
        <label className="text-sm font-medium text-gray-700">Language:</label>
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value as "ur" | "en")}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isProcessing}
        >
          <option value="en">English</option>
          <option value="ur">اردو</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          💡 Select language for better transcription/OCR
        </span>
      </div>

      {/* Drop Zone */}
      <AnimatePresence>
        {!extractedText && !processingError && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              {...getRootProps()}
              className={`relative p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer
                ${
                  isDragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }
                ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center justify-center gap-3 py-4">
                <div className="flex gap-4">
                  <div className="text-gray-400">
                    <Mic className="w-8 h-8" />
                  </div>
                  <div className="text-gray-400">
                    <Camera className="w-8 h-8" />
                  </div>
                  <div className="text-gray-400">
                    <FileText className="w-8 h-8" />
                  </div>
                </div>

                {isProcessing ? (
                  <div className="flex items-center gap-2 flex-col">
                    <Loader className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">
                      {processingStatus}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        {isDragActive
                          ? "Drop your file here..."
                          : "Drag audio, image, or PDF here"}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Supported: MP3, WAV, OGG, JPG, PNG, PDF (up to 25MB)
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {processingError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 bg-red-50 border border-red-300 rounded-lg"
          >
            <div className="flex gap-3">
              <div className="text-red-600 flex-shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-red-900 mb-1">
                  {processingError.title}
                </h3>
                <p className="text-sm text-red-800 mb-2">
                  {processingError.message}
                </p>
                {processingError.suggestion && (
                  <p className="text-xs text-red-700 bg-red-100 p-2 rounded mb-3">
                    💡 <strong>Suggestion:</strong> {processingError.suggestion}
                  </p>
                )}
                <motion.button
                  onClick={clearExtracted}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Again
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extracted Text Preview - Success State */}
      <AnimatePresence>
        {extractedText && !processingError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 bg-green-50 border border-green-300 rounded-lg"
          >
            <div className="flex gap-3 mb-2">
              <div className="text-green-600 flex-shrink-0">
                <Check className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">
                    ✓ Text Extracted Successfully
                  </span>
                  <span className="text-xs px-2 py-1 bg-green-200 text-green-800 rounded-full font-medium">
                    {extractedText.mediaType.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-600 ml-auto">
                    Confidence:{" "}
                    <strong>
                      {(extractedText.confidence * 100).toFixed(0)}%
                    </strong>
                  </span>
                </div>

                <p className="text-xs text-gray-600 mb-3">
                  <strong>File:</strong> {extractedText.fileName} •
                  <strong className="ml-2">Characters:</strong>{" "}
                  {extractedText.text.length} •
                  <strong className="ml-2">Language:</strong>{" "}
                  {extractedText.language === "ur" ? "اردو" : "English"}
                </p>

                {/* Text Preview with proper RTL support */}
                <div
                  className={`bg-white rounded p-3 mb-3 max-h-40 overflow-y-auto border border-green-200 ${
                    extractedText.language === "ur" ? "text-right" : "text-left"
                  }`}
                  dir={extractedText.language === "ur" ? "rtl" : "ltr"}
                >
                  <p
                    className={`text-sm text-gray-700 whitespace-pre-wrap break-words font-[system-ui] ${
                      extractedText.language === "ur"
                        ? "font-['Segoe UI','Arial']"
                        : ""
                    }`}
                  >
                    {extractedText.text.slice(0, 400)}
                    {extractedText.text.length > 400 ? "..." : ""}
                  </p>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    onClick={() => {
                      navigator.clipboard.writeText(extractedText.text);
                      setProcessingStatus("✓ Copied to clipboard!");
                      setTimeout(() => setProcessingStatus(""), 2000);
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Check className="w-4 h-4" />
                    Copy Text
                  </motion.button>
                  <motion.button
                    onClick={clearExtracted}
                    className="px-3 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-400 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Clear
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Message - Processing */}
      {processingStatus && !extractedText && !processingError && (
        <motion.div
          className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 items-start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">{processingStatus}</p>
        </motion.div>
      )}
    </div>
  );
};

export default MediaUploadWidget;
