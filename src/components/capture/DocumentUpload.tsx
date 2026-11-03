'use client';

import React, { useState, useRef } from 'react';
import { useMunshiStore } from '@/store/useMunshiStore';
import { MunshiApiClient } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import {
  Upload,
  Camera,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CaseDoc, Contact, Fact } from '@/contracts';

interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
  jobId?: string;
  controller?: AbortController;
}

interface DocumentUploadProps {
  uploadMode: 'expected' | 'optional' | 'hidden';
  onDocumentProcessed: (doc: CaseDoc, fields?: Fact[], contacts?: Contact[]) => void;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  uploadMode,
  onDocumentProcessed,
}) => {
  const { prefs, setError } = useMunshiStore();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(uploadMode === 'optional');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Hidden mode: don't render anything
  if (uploadMode === 'hidden') {
    return null;
  }

  // Helper to downscale large camera images client-side (PRD FE-7)
  const downscaleImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const maxDim = 2048; // Safe high-res limit for OCR
        let { width, height } = img;

        if (width <= maxDim && height <= maxDim) {
          resolve(file);
          return;
        }

        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(resizedFile);
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
    });
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);

    for (const rawFile of filesArray) {
      // Validate file extension / type
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      if (!validTypes.includes(rawFile.type)) {
        setError({
          code: 'FILE_UNSUPPORTED',
          message: `${rawFile.name}: Unsupported format. Please upload PDF, PNG or JPG.`,
          retryable: false,
          requestId: '',
        });
        continue;
      }

      // Check if already uploaded
      if (uploads.some((u) => u.name === rawFile.name && u.status === 'completed')) {
        continue;
      }

      const file = await downscaleImage(rawFile);
      const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const controller = new AbortController();

      const item: UploadItem = {
        id: uploadId,
        file,
        name: file.name,
        size: file.size,
        progress: 10,
        status: 'uploading',
        controller,
      };

      setUploads((prev) => [...prev, item]);
      processUpload(item);
    }
  };

  const processUpload = async (item: UploadItem) => {
    try {
      // 1. Upload to /api/vision to get jobId
      const { jobId } = await MunshiApiClient.uploadDocument(
        item.file,
        item.controller?.signal
      );

      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id ? { ...u, jobId, status: 'processing', progress: 30 } : u
        )
      );

      // 2. Poll status with backoff
      const result = await MunshiApiClient.pollVisionStatus(
        jobId,
        (progress) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, progress: Math.max(30, progress) } : u))
          );
        },
        item.controller?.signal
      );

      // 3. Mark completed and notify callback
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'completed', progress: 100 } : u))
      );

      const caseDoc: CaseDoc = {
        id: item.id,
        name: item.name,
        pages: result.pages || 1,
        markdown: result.markdown || '',
      };

      onDocumentProcessed(caseDoc, result.fields, result.contacts);
    } catch (err: any) {
      if (err.name === 'AbortError') return;

      setUploads((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? {
                ...u,
                status: 'failed',
                error: err.message || 'Vision processing failed',
              }
            : u
        )
      );
    }
  };

  const cancelUpload = (id: string) => {
    const item = uploads.find((u) => u.id === id);
    if (item && item.controller) {
      item.controller.abort();
    }
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const retryUpload = (id: string) => {
    const item = uploads.find((u) => u.id === id);
    if (!item) return;

    const controller = new AbortController();
    const updated: UploadItem = {
      ...item,
      status: 'uploading',
      progress: 10,
      error: undefined,
      controller,
    };

    setUploads((prev) => prev.map((u) => (u.id === id ? updated : u)));
    processUpload(updated);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      {/* Header if optional */}
      {uploadMode === 'optional' && (
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900"
        >
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-munshi-600" />
            {t('capture.upload_optional', prefs.uiLang)}
          </span>
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      )}

      {(!isCollapsed || uploadMode === 'expected') && (
        <div className={uploadMode === 'optional' ? 'mt-3' : ''}>
          {uploadMode === 'expected' && (
            <div className="mb-2 text-xs font-semibold text-slate-700">
              {t('capture.upload_expected', prefs.uiLang)}
            </div>
          )}

          {/* Drag & drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              isDragging
                ? 'border-munshi-500 bg-munshi-50'
                : 'border-slate-200 hover:border-munshi-400 hover:bg-slate-50'
            }`}
          >
            <Upload className="h-6 w-6 text-munshi-600 mb-1.5" />
            <p className="text-xs text-slate-700 font-medium">
              {t('capture.upload_dropzone', prefs.uiLang)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              PDF, PNG, JPG (max 10 pages)
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-munshi-50 px-3 py-1 text-xs font-medium text-munshi-700 hover:bg-munshi-100 transition-colors"
              >
                Browse files
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Camera className="h-3 w-3" />
                Camera
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* List of uploaded / processing files */}
          {uploads.length > 0 && (
            <div className="mt-3 space-y-2">
              {uploads.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                    <div className="truncate">
                      <div className="font-medium text-slate-800 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {(item.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === 'uploading' && (
                      <span className="flex items-center gap-1 text-[11px] text-munshi-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Uploading
                      </span>
                    )}

                    {item.status === 'processing' && (
                      <span className="flex items-center gap-1 text-[11px] text-munshi-600 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Vision {item.progress}%
                      </span>
                    )}

                    {item.status === 'completed' && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Ready
                      </span>
                    )}

                    {item.status === 'failed' && (
                      <span className="flex items-center gap-1 text-[11px] text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Failed
                      </span>
                    )}

                    {item.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => retryUpload(item.id)}
                        className="rounded p-1 text-slate-500 hover:text-slate-800"
                        title="Retry"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => cancelUpload(item.id)}
                      className="rounded p-1 text-slate-400 hover:text-slate-700"
                      title="Cancel/Remove"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
