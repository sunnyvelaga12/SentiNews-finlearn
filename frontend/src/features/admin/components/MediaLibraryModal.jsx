import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Search, Check, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';

export const MediaLibraryModal = ({ isOpen, onClose, onSelect, activeAssetId = null }) => {
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, search]);

  const loadMedia = async () => {
    setIsLoading(true);
    try {
      const url = search 
        ? `/api/v1/admin/media?search=${encodeURIComponent(search)}`
        : '/api/v1/admin/media';
      const res = await apiClient(url);
      setAssets(res.media || []);
      if (activeAssetId && !selectedAsset) {
        const found = (res.media || []).find(a => a.media_asset_id === activeAssetId || a.id === activeAssetId);
        if (found) setSelectedAsset(found);
      }
    } catch (err) {
      console.error('Failed to load media assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('alt_text', file.name);

    try {
      const token = localStorage.getItem('sentinews_token') || '';
      const response = await fetch('/api/v1/admin/media/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-User-Id': '00000000-0000-0000-0000-000000000001',
        },
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.detail || 'Upload failed');
      }

      const created = await response.json();
      setSelectedAsset(created);
      await loadMedia();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#FBFBFA] border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Media Asset Library</h2>
              <p className="text-xs text-slate-500">Select or upload verified charts, candle diagrams, and illustrations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search media assets by filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Upload Image</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          />
        </div>

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Grid / Content Area */}
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex-1 overflow-y-auto p-6 grid grid-cols-3 sm:grid-cols-4 gap-4"
        >
          {isLoading ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
              <p className="text-xs">Loading media assets...</p>
            </div>
          ) : assets.length === 0 ? (
            <div className="col-span-full py-16 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <Upload className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-600">No media assets found</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Drag and drop a PNG, JPEG, or WebP chart or illustration here, or click Upload Image above.
              </p>
            </div>
          ) : (
            assets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id || selectedAsset?.media_asset_id === asset.media_asset_id;
              return (
                <div
                  key={asset.id || asset.media_asset_id}
                  onClick={() => setSelectedAsset(asset)}
                  className={`group relative rounded-xl border overflow-hidden cursor-pointer transition-all bg-white flex flex-col ${
                    isSelected 
                      ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md' 
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="aspect-video w-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    <img
                      src={asset.url}
                      alt={asset.filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => { e.target.src = 'https://via.placeholder.com/300x200?text=Chart'; }}
                    />
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="p-2.5 flex flex-col justify-between flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>{asset.width && asset.height ? `${asset.width}×${asset.height}` : 'Image'}</span>
                      <span>{(asset.file_size_bytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedAsset ? (
              <span className="font-medium text-slate-700">
                Selected: <span className="text-blue-600">{selectedAsset.filename}</span>
              </span>
            ) : (
              <span>Select an asset to attach to this block</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!selectedAsset}
              onClick={() => {
                if (selectedAsset) {
                  onSelect(selectedAsset);
                  onClose();
                }
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Insert Selected Asset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
