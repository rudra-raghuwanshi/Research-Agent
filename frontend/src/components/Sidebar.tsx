"use client";
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Trash2, Upload, BookOpen, Loader2 } from "lucide-react";

type Props = {
  papers: string[];
  onUpload: (file: File) => void;
  onDelete: (filename: string) => void;
  uploading: boolean;
  loading: boolean;
};

export default function Sidebar({ papers, onUpload, onDelete, uploading, loading }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) onUpload(acceptedFiles[0]);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  return (
    <div className="w-72 bg-[#1a1d2e] border-r border-[#2d3154] flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-[#2d3154]">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="text-violet-400" size={22} />
          <h1 className="text-lg font-bold text-white">Research Agent</h1>
        </div>
        <p className="text-xs text-slate-400">Powered by Gemma 4 E4B</p>
      </div>

      {/* Upload Area */}
      <div className="p-4 border-b border-[#2d3154]">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Upload Paper</p>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
            ${isDragActive ? "border-violet-400 bg-violet-400/10" : "border-[#3b4263] hover:border-violet-400 hover:bg-violet-400/5"}
            ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-2 text-violet-400" size={24} />
          {uploading ? (
            <p className="text-sm text-violet-300">Uploading & indexing...</p>
          ) : isDragActive ? (
            <p className="text-sm text-violet-300">Drop PDF here!</p>
          ) : (
            <>
              <p className="text-sm text-slate-300">Drag & drop PDF</p>
              <p className="text-xs text-slate-500 mt-1">or click to browse</p>
            </>
          )}
        </div>
      </div>

      {/* Papers List */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">
          Papers ({papers.length})
        </p>
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="mx-auto mb-2 text-violet-400 animate-spin" size={32} />
            <p className="text-sm text-slate-500">Loading papers...</p>
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="mx-auto mb-2 text-slate-600" size={32} />
            <p className="text-sm text-slate-500">No papers uploaded yet</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {papers.map((paper) => (
              <li
                key={paper}
                className="flex items-center gap-2 bg-[#0f1117] rounded-lg p-3 group"
              >
                <FileText className="text-violet-400 shrink-0" size={16} />
                <span className="text-sm text-slate-300 truncate flex-1" title={paper}>
                  {paper}
                </span>
                <button
                  onClick={() => onDelete(paper)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[#2d3154]">
        <p className="text-xs text-slate-500 text-center">🔒 100% Local & Private</p>
      </div>
    </div>
  );
}
