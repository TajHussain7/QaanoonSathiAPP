import React, { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "motion/react";
import { apiCall } from "../services/apiClient";
import {
  Mic,
  MicOff,
  Camera,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader,
  Square,
  Upload,
  Play,
  Pause,
  Volume2,
  Image,
  File,
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

type TabType = "voice" | "media";

// ─── Voice Recorder Component ─────────────────────────────────────────────────
const VoiceRecorder: React.FC<{
  selectedLanguage: "ur" | "en";
  onLanguageChange: (lang: "ur" | "en") => void;
  onTextExtracted: (text: string, mediaType: string, language: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}> = ({
  selectedLanguage,
  onLanguageChange,
  onTextExtracted,
  onError,
  disabled,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [processingError, setProcessingError] =
    useState<ProcessingError | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    setTranscript(null);
    setProcessingError(null);
    setAudioBlob(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        await transcribeAudio(blob);
      };

      recorder.start(200);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err: any) {
      const msg =
        err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone in browser settings."
          : err.message || "Could not access microphone.";
      setProcessingError({ title: "Microphone Error", message: msg });
      onError(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(
          () => setRecordingDuration((d) => d + 1),
          1000,
        );
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsProcessing(true);
    setStatusMessage("Transcribing your voice...");

    try {
      const formData = new FormData();
      const ext = blob.type.includes("webm") ? "webm" : "ogg";
      formData.append("audio", blob, `recording.${ext}`);
      formData.append("language", selectedLanguage);

      const response = await apiCall("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.message || `Transcription failed (${response.status})`,
        );
      }

      const result = await response.json();
      if (!result.text || result.text.trim().length === 0) {
        throw new Error(
          "No speech detected. Please try speaking more clearly.",
        );
      }

      setTranscript(result.text);
      setStatusMessage("");
      onTextExtracted(
        result.text,
        "audio",
        result.language || selectedLanguage,
      );
    } catch (err: any) {
      const msg = err.message || "Transcription failed.";
      setProcessingError({
        title: "Transcription Failed",
        message: msg,
        suggestion: "Speak clearly and ensure your microphone is working.",
      });
      onError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setTranscript(null);
    setProcessingError(null);
    setAudioBlob(null);
    setStatusMessage("");
    setRecordingDuration(0);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="space-y-4">
      {/* Language Selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-[#065016]/60 uppercase tracking-widest">
          Language:
        </span>
        <div className="flex bg-[#065016]/5 rounded-lg p-0.5">
          {(["en", "ur"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onLanguageChange(l)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                selectedLanguage === l
                  ? "bg-[#065016] text-white shadow-sm"
                  : "text-[#065016]/60 hover:text-[#065016]"
              } ${l === "ur" ? "font-urdu text-sm" : ""}`}
            >
              {l === "en" ? "English" : "اردو"}
            </button>
          ))}
        </div>
      </div>

      {/* Recording UI */}
      <AnimatePresence mode="wait">
        {!transcript && !processingError && !isProcessing && (
          <motion.div
            key="record"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="flex flex-col items-center gap-4 py-6"
          >
            {/* Big record button */}
            <div className="relative">
              {isRecording && (
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 bg-red-500/20 rounded-full"
                />
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={disabled}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-[#065016] hover:bg-[#065016]/90"
                }`}
              >
                {isRecording ? (
                  <Square size={28} className="text-white" fill="white" />
                ) : (
                  <Mic size={28} className="text-white" />
                )}
              </button>
            </div>

            {/* Status */}
            {isRecording ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500 font-bold text-sm">
                    Recording {formatDuration(recordingDuration)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={pauseRecording}
                    className="px-4 py-2 bg-[#065016]/10 text-[#065016] rounded-lg text-xs font-bold hover:bg-[#065016]/20 transition-colors flex items-center gap-1.5"
                  >
                    {isPaused ? <Play size={14} /> : <Pause size={14} />}
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                  <button
                    onClick={stopRecording}
                    className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors flex items-center gap-1.5"
                  >
                    <Square size={14} />
                    Stop & Transcribe
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm font-semibold text-[#065016]/60">
                  Press to start recording your voice query
                </p>
                <p className="text-xs text-[#065016]/30 mt-1">
                  Supports English and Urdu speech
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Processing */}
        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <div className="w-14 h-14 rounded-full bg-[#065016]/10 flex items-center justify-center">
              <Loader size={24} className="text-[#065016] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#065016]/60">
              {statusMessage || "Processing..."}
            </p>
          </motion.div>
        )}

        {/* Success */}
        {transcript && !processingError && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-[#065016]/5 border border-[#065016]/20 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#065016] flex items-center justify-center flex-shrink-0">
                <Volume2 size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-[#065016] uppercase tracking-widest mb-1.5">
                  Transcribed
                </p>
                <p
                  className="text-sm text-[#2C2621] leading-relaxed bg-white rounded-lg p-3 border border-[#065016]/10"
                  dir={selectedLanguage === "ur" ? "rtl" : "ltr"}
                >
                  {transcript.slice(0, 300)}
                  {transcript.length > 300 ? "…" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 bg-[#065016]/10 text-[#065016] text-xs font-bold rounded-lg hover:bg-[#065016]/20 transition-colors w-full"
            >
              Record Again
            </button>
          </motion.div>
        )}

        {/* Error */}
        {processingError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl"
          >
            <div className="flex gap-3">
              <AlertCircle
                size={18}
                className="text-red-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-bold text-red-800 mb-1">
                  {processingError.title}
                </p>
                <p className="text-xs text-red-700 mb-2">
                  {processingError.message}
                </p>
                {processingError.suggestion && (
                  <p className="text-xs text-red-600 bg-red-100 px-3 py-2 rounded-lg mb-3">
                    💡 {processingError.suggestion}
                  </p>
                )}
                <button
                  onClick={reset}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Media Upload Component ────────────────────────────────────────────────────
const MediaUpload: React.FC<{
  selectedLanguage: "ur" | "en";
  onLanguageChange: (lang: "ur" | "en") => void;
  onTextExtracted: (text: string, mediaType: string, language: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}> = ({
  selectedLanguage,
  onLanguageChange,
  onTextExtracted,
  onError,
  disabled,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<ExtractedMedia | null>(
    null,
  );
  const [processingStatus, setProcessingStatus] = useState("");
  const [processingError, setProcessingError] =
    useState<ProcessingError | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      await processMediaFile(acceptedFiles[0]);
    },
    [selectedLanguage],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"],
      "application/pdf": [".pdf"],
    },
    disabled: isProcessing || disabled,
    multiple: false,
  });

  const processMediaFile = async (file: File) => {
    setIsProcessing(true);
    setExtractedText(null);
    setProcessingError(null);
    setProcessingStatus(`Processing ${file.name}…`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", selectedLanguage);

      const response = await apiCall("/api/extract-text", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.message || `Upload failed (${response.status})`,
        );
      }

      const result = await response.json();

      if (!result.text || result.text.trim().length === 0) {
        throw new Error(
          "No text found in this file. Please check the file and try again.",
        );
      }

      const mediaType: "image" | "pdf" = file.type.includes("pdf")
        ? "pdf"
        : "image";
      const extracted: ExtractedMedia = {
        text: result.text,
        mediaType,
        fileName: file.name,
        confidence: result.confidence || 0.9,
        language: result.language || selectedLanguage,
      };

      setExtractedText(extracted);
      setProcessingStatus("");
      setTimeout(() => {
        onTextExtracted(
          result.text,
          mediaType,
          result.language || selectedLanguage,
        );
      }, 800);
    } catch (err: any) {
      const msg = err.message || "Failed to process file.";
      setProcessingError({
        title: "Processing Failed",
        message: msg,
        suggestion: "Ensure the file is not corrupted and is under 25MB.",
      });
      onError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearExtracted = () => {
    setExtractedText(null);
    setProcessingStatus("");
    setProcessingError(null);
  };

  return (
    <div className="space-y-4">
      {/* Language Selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-[#065016]/60 uppercase tracking-widest">
          Language:
        </span>
        <div className="flex bg-[#065016]/5 rounded-lg p-0.5">
          {(["en", "ur"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onLanguageChange(l)}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                selectedLanguage === l
                  ? "bg-[#065016] text-white shadow-sm"
                  : "text-[#065016]/60 hover:text-[#065016]"
              } ${l === "ur" ? "font-urdu text-sm" : ""}`}
            >
              {l === "en" ? "English" : "اردو"}
            </button>
          ))}
        </div>
      </div>

      {/* Drop Zone */}
      <AnimatePresence>
        {!extractedText && !processingError && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              {...getRootProps()}
              className={`relative p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer
                ${
                  isDragActive
                    ? "border-[#065016] bg-[#065016]/5 scale-[1.01]"
                    : "border-[#065016]/20 bg-white hover:bg-[#065016]/[0.02] hover:border-[#065016]/40"
                }
                ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="flex gap-4 text-[#065016]/25">
                  <Image size={28} />
                  <File size={28} />
                </div>

                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader size={18} className="animate-spin text-[#065016]" />
                    <span className="text-sm font-semibold text-[#065016]/60">
                      {processingStatus}
                    </span>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#065016]/60">
                      {isDragActive
                        ? "Drop your file here…"
                        : "Drag image or PDF here, or click to browse"}
                    </p>
                    <p className="text-xs text-[#065016]/30 mt-1">
                      JPG, PNG, WEBP, PDF — up to 25MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success */}
      <AnimatePresence>
        {extractedText && !processingError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-[#065016]/5 border border-[#065016]/20 rounded-xl"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-[#065016] flex items-center justify-center flex-shrink-0">
                <Check size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-black text-[#065016] uppercase tracking-widest">
                    Text Extracted
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-[#065016] text-white rounded-full font-bold">
                    {extractedText.mediaType.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-[#065016]/40 ml-auto">
                    {extractedText.text.length} chars
                  </span>
                </div>
                <p className="text-xs text-[#065016]/40 mb-2">
                  {extractedText.fileName} •{" "}
                  {extractedText.language === "ur" ? "اردو" : "English"}
                </p>
                <div
                  className="bg-white rounded-lg p-3 border border-[#065016]/10 max-h-28 overflow-y-auto text-sm text-[#2C2621] leading-relaxed"
                  dir={extractedText.language === "ur" ? "rtl" : "ltr"}
                >
                  {extractedText.text.slice(0, 300)}
                  {extractedText.text.length > 300 ? "…" : ""}
                </div>
              </div>
            </div>
            <button
              onClick={clearExtracted}
              className="px-4 py-2 bg-[#065016]/10 text-[#065016] text-xs font-bold rounded-lg hover:bg-[#065016]/20 transition-colors w-full"
            >
              Upload Another File
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {processingError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl"
          >
            <div className="flex gap-3">
              <AlertCircle
                size={18}
                className="text-red-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm font-bold text-red-800 mb-1">
                  {processingError.title}
                </p>
                <p className="text-xs text-red-700 mb-2">
                  {processingError.message}
                </p>
                {processingError.suggestion && (
                  <p className="text-xs text-red-600 bg-red-100 px-3 py-2 rounded-lg mb-3">
                    💡 {processingError.suggestion}
                  </p>
                )}
                <button
                  onClick={clearExtracted}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Widget ──────────────────────────────────────────────────────────────
const MediaUploadWidget: React.FC<MediaUploadWidgetProps> = ({
  onTextExtracted,
  onError,
  disabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("voice");
  const [isExpanded, setIsExpanded] = useState(false);
  const [sharedLanguage, setSharedLanguage] = useState<"ur" | "en">("en");

  return (
    <div className="border border-[#065016]/15 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Widget header / toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-[#065016]/[0.03] hover:bg-[#065016]/[0.06] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${activeTab === "voice" && isExpanded ? "bg-red-400 animate-pulse" : "bg-[#065016]/20"}`}
            />
          </div>
          <span className="text-[11px] font-black text-[#065016]/60 uppercase tracking-widest">
            Voice & Media Input
          </span>
        </div>
        <div
          className={`w-5 h-5 rounded-md bg-[#065016]/10 flex items-center justify-center text-[#065016]/50 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        >
          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-5">
              {/* Tabs */}
              <div className="flex gap-1 mb-5 bg-[#065016]/5 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab("voice")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "voice"
                      ? "bg-white text-[#065016] shadow-sm"
                      : "text-[#065016]/50 hover:text-[#065016]"
                  }`}
                >
                  <Mic size={14} />
                  Voice Discussion
                </button>
                <button
                  onClick={() => setActiveTab("media")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "media"
                      ? "bg-white text-[#065016] shadow-sm"
                      : "text-[#065016]/50 hover:text-[#065016]"
                  }`}
                >
                  <Upload size={14} />
                  Image / PDF
                </button>
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {activeTab === "voice" ? (
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <VoiceRecorder
                      selectedLanguage={sharedLanguage}
                      onLanguageChange={setSharedLanguage}
                      onTextExtracted={onTextExtracted}
                      onError={onError}
                      disabled={disabled}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="media"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    <MediaUpload
                      selectedLanguage={sharedLanguage}
                      onLanguageChange={setSharedLanguage}
                      onTextExtracted={onTextExtracted}
                      onError={onError}
                      disabled={disabled}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Disclaimer */}
              <p className="text-[10px] text-[#065016]/25 text-center mt-4 font-medium">
                Audio and media are processed securely and not stored
                permanently.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MediaUploadWidget;
