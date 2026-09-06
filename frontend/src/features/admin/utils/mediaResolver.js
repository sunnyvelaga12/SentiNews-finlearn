import { useState, useEffect } from 'react';
import { apiClient, resolveEndpointUrl } from '../../../services/apiClient';

// Global in-memory media metadata cache
const mediaCache = new Map();
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

/**
 * Stores media asset metadata in client cache (e.g. from picker or upload).
 */
export function cacheMediaAsset(asset) {
  if (!asset || !asset.id) return;
  const id = String(asset.id || asset.media_asset_id);
  const rawUrl = asset.url || asset.asset_url || `/uploads/media/${asset.storage_key || ''}`;
  const resolvedUrl = rawUrl ? resolveEndpointUrl(rawUrl) : null;
  mediaCache.set(id, {
    id,
    media_asset_id: id,
    url: resolvedUrl,
    raw_url: rawUrl,
    filename: asset.filename,
    alt_text: asset.alt_text,
    caption: asset.caption,
  });
  notifyListeners();
}

/**
 * Synchronously retrieves cached media URL for a given media_asset_id, or null.
 */
export function getCachedMediaUrl(mediaAssetId) {
  if (!mediaAssetId) return null;
  const item = mediaCache.get(String(mediaAssetId));
  return item ? item.url : null;
}

/**
 * Asynchronously resolves a media asset by canonical UUID.
 */
export async function resolveMediaAsset(mediaAssetId) {
  if (!mediaAssetId) return null;
  const id = String(mediaAssetId);
  if (mediaCache.has(id)) {
    return mediaCache.get(id);
  }

  try {
    const data = await apiClient(`/api/v1/learning/media/${id}`).catch(() => apiClient(`/api/v1/admin/media/${id}`));
    if (data) {
      cacheMediaAsset(data);
      return mediaCache.get(id);
    }
  } catch (err) {
    console.warn(`Failed to resolve media asset ${id}:`, err);
  }
  return null;
}

/**
 * React Hook that dynamically resolves the display URL for any canonical media_asset_id.
 * Enforces single source of truth: URLs are derived, NEVER persisted into LessonVersion.blocks_json.
 */
export function useMediaAsset(mediaAssetId) {
  const [asset, setAsset] = useState(() => (mediaAssetId ? mediaCache.get(String(mediaAssetId)) || null : null));
  const [isLoading, setIsLoading] = useState(!asset && !!mediaAssetId);

  useEffect(() => {
    if (!mediaAssetId) {
      setAsset(null);
      setIsLoading(false);
      return;
    }

    const id = String(mediaAssetId);
    if (mediaCache.has(id)) {
      setAsset(mediaCache.get(id));
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    resolveMediaAsset(id).then((res) => {
      if (isMounted) {
        setAsset(res);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [mediaAssetId]);

  return { asset, url: asset?.url || null, isLoading };
}
