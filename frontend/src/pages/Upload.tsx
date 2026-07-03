import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileImage, 
  Sparkles, 
  AlertCircle 
} from 'lucide-react';
import { apiService } from '../services/api';
import type { DiagnosticResult } from '../services/api';

interface UploadProps {
  onAnalysisComplete: (result: DiagnosticResult) => void;
}

export const Upload: React.FC<UploadProps> = ({ onAnalysisComplete }) => {
  const [patientId, setPatientId] = useState('');
  const [modalityOverride, setModalityOverride] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    // Create a local URL preview for PNG/JPEG scans
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null); // No preview for raw NIfTI/DICOM binary scans
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please select a scan file to analyze.');
      return;
    }
    if (!patientId.trim()) {
      setError('Please enter a Patient Identifier.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiService.analyzeScan(
        file,
        patientId,
        modalityOverride || undefined
      );
      onAnalysisComplete(result);
    } catch (e: any) {
      const errMsg = e.response?.data?.detail || e.message || 'Analysis pipeline execution failed.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in py-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ingest Scans</h2>
        <p className="text-gray-400 text-sm mt-1">
          Upload Chest X-Rays (PNG/JPEG/DICOM) or Brain MRIs (DICOM/NIfTI) to execute ML inference.
        </p>
      </div>

      <div className="p-8 glass-panel space-y-6">
        {/* Patient ID and override */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Patient Identifier</label>
            <input
              type="text"
              placeholder="e.g. PT-49033"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#070b13] border border-white/10 focus:border-purple-500 focus:outline-none text-white text-sm transition"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Modality Override</label>
            <select
              value={modalityOverride}
              onChange={(e) => setModalityOverride(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#070b13] border border-white/10 focus:border-purple-500 focus:outline-none text-white text-sm transition"
            >
              <option value="">Auto-Detect Modality</option>
              <option value="chest_xray">Chest X-Ray</option>
              <option value="brain_mri">Brain MRI</option>
            </select>
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition duration-200 ${
            file 
              ? 'border-purple-500/50 bg-purple-500/5' 
              : 'border-white/10 bg-[#070b13]/40 hover:border-white/20 hover:bg-[#070b13]/60'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
            className="hidden"
          />
          {file ? (
            <div className="space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                <FileImage className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{file.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <div className="h-12 w-12 rounded-full bg-white/5 text-gray-400 flex items-center justify-center mx-auto">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Drag and drop file here</p>
                <p className="text-xs text-gray-500 mt-1">Supports PNG, JPEG, DCM, NII, NII.GZ</p>
              </div>
            </div>
          )}
        </div>

        {/* Preview image */}
        {previewUrl && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Image Preview</label>
            <div className="rounded-lg overflow-hidden border border-white/5 bg-[#070b13]/60 flex items-center justify-center p-4">
              <img src={previewUrl} alt="Preview" className="max-h-64 object-contain rounded" />
            </div>
          </div>
        )}

        {/* Error panel */}
        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !file}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-sm transition duration-200 shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2 text-white"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running Vision & Reasoning Pipeline...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Run MedGraph Diagnostics
            </>
          )}
        </button>
      </div>
    </div>
  );
};
