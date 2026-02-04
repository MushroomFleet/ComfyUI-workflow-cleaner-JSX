/**
 * ComfyImage Stripper Component
 * 
 * A React component that removes ComfyUI JSON metadata from PNG and JPEG images
 * in a non-destructive way - the actual image data is never modified, only 
 * metadata chunks are stripped.
 * 
 * ComfyUI embeds workflow JSON in:
 * - PNG: tEXt/iTXt chunks with keys "prompt" and "workflow"
 * - JPEG: APP1 (EXIF), APP13, or Comment (COM) segments
 */

import React, { useState, useCallback, useRef } from 'react';

// PNG chunk types that contain ComfyUI metadata
const COMFY_PNG_CHUNK_KEYS = ['prompt', 'workflow', 'parameters'];

// JPEG markers to strip (APP1=EXIF, APP13=Photoshop/IPTC, COM=Comment)
const STRIP_JPEG_MARKERS = [0xE1, 0xED, 0xFE];

/**
 * Parse PNG file and remove ComfyUI metadata chunks
 * @param {ArrayBuffer} buffer - The PNG file as ArrayBuffer
 * @returns {{ cleanedBuffer: ArrayBuffer, removedChunks: Array, isModified: boolean }}
 */
function stripPngMetadata(buffer) {
  const data = new Uint8Array(buffer);
  const removedChunks = [];
  
  // Verify PNG signature
  const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Not a valid PNG file');
    }
  }
  
  const chunks = [];
  let offset = 8; // Skip signature
  
  while (offset < data.length) {
    // Read chunk length (4 bytes, big-endian)
    const length = (data[offset] << 24) | (data[offset + 1] << 16) | 
                   (data[offset + 2] << 8) | data[offset + 3];
    
    // Read chunk type (4 bytes)
    const type = String.fromCharCode(
      data[offset + 4], data[offset + 5], 
      data[offset + 6], data[offset + 7]
    );
    
    // Calculate total chunk size (length + type + data + CRC)
    const chunkSize = 4 + 4 + length + 4;
    const chunkData = data.slice(offset, offset + chunkSize);
    
    // Check if this is a text chunk with ComfyUI metadata
    let shouldStrip = false;
    let chunkInfo = { type, length };
    
    if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      // Extract the keyword from the chunk
      const dataStart = offset + 8;
      let keyEnd = dataStart;
      while (keyEnd < dataStart + length && data[keyEnd] !== 0) {
        keyEnd++;
      }
      const keyword = new TextDecoder('latin1').decode(
        data.slice(dataStart, keyEnd)
      );
      chunkInfo.keyword = keyword;
      
      // Check if this is a ComfyUI metadata chunk
      if (COMFY_PNG_CHUNK_KEYS.includes(keyword.toLowerCase())) {
        shouldStrip = true;
        
        // Try to extract the JSON content for display
        try {
          let textStart = keyEnd + 1;
          if (type === 'iTXt') {
            // iTXt has compression flag, compression method, language tag, translated keyword
            textStart = keyEnd + 1; // Skip null after keyword
            if (data[textStart] === 0) textStart++; // compression flag
            if (data[textStart] === 0) textStart++; // compression method
            while (textStart < dataStart + length && data[textStart] !== 0) textStart++; // language
            textStart++;
            while (textStart < dataStart + length && data[textStart] !== 0) textStart++; // translated keyword
            textStart++;
          }
          const textData = data.slice(textStart, dataStart + length);
          const textContent = new TextDecoder('utf-8').decode(textData);
          if (textContent.startsWith('{')) {
            const json = JSON.parse(textContent);
            chunkInfo.jsonPreview = JSON.stringify(json, null, 2).slice(0, 500) + '...';
          }
        } catch (e) {
          chunkInfo.jsonPreview = '[Could not parse JSON]';
        }
      }
    }
    
    if (shouldStrip) {
      removedChunks.push(chunkInfo);
    } else {
      chunks.push(chunkData);
    }
    
    offset += chunkSize;
  }
  
  // Reassemble PNG
  const totalSize = PNG_SIGNATURE.length + chunks.reduce((acc, c) => acc + c.length, 0);
  const cleanedBuffer = new ArrayBuffer(totalSize);
  const cleanedData = new Uint8Array(cleanedBuffer);
  
  // Write signature
  for (let i = 0; i < 8; i++) {
    cleanedData[i] = PNG_SIGNATURE[i];
  }
  
  // Write remaining chunks
  let writeOffset = 8;
  for (const chunk of chunks) {
    cleanedData.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  
  return {
    cleanedBuffer,
    removedChunks,
    isModified: removedChunks.length > 0
  };
}

/**
 * Parse JPEG file and remove metadata segments
 * @param {ArrayBuffer} buffer - The JPEG file as ArrayBuffer
 * @returns {{ cleanedBuffer: ArrayBuffer, removedSegments: Array, isModified: boolean }}
 */
function stripJpegMetadata(buffer) {
  const data = new Uint8Array(buffer);
  const removedSegments = [];
  
  // Verify JPEG signature
  if (data[0] !== 0xFF || data[1] !== 0xD8) {
    throw new Error('Not a valid JPEG file');
  }
  
  const segments = [];
  let offset = 0;
  
  // Add SOI marker
  segments.push(data.slice(0, 2));
  offset = 2;
  
  while (offset < data.length - 1) {
    if (data[offset] !== 0xFF) {
      offset++;
      continue;
    }
    
    const marker = data[offset + 1];
    
    // Handle standalone markers
    if (marker === 0xD8 || marker === 0xD9 || marker === 0x01 || 
        (marker >= 0xD0 && marker <= 0xD7)) {
      if (marker === 0xD9) {
        // EOI - end of image, include it and stop
        segments.push(data.slice(offset, offset + 2));
        offset += 2;
        break;
      }
      segments.push(data.slice(offset, offset + 2));
      offset += 2;
      continue;
    }
    
    // Handle SOS (Start of Scan) - the rest is entropy-coded data
    if (marker === 0xDA) {
      const length = (data[offset + 2] << 8) | data[offset + 3];
      // Find the next marker (skip entropy-coded data)
      let endOffset = offset + 2 + length;
      while (endOffset < data.length - 1) {
        if (data[endOffset] === 0xFF && data[endOffset + 1] !== 0x00 && 
            data[endOffset + 1] !== 0xFF) {
          break;
        }
        endOffset++;
      }
      segments.push(data.slice(offset, endOffset));
      offset = endOffset;
      continue;
    }
    
    // Handle segments with length
    if (offset + 4 > data.length) break;
    
    const length = (data[offset + 2] << 8) | data[offset + 3];
    const segmentData = data.slice(offset, offset + 2 + length);
    
    // Check if this segment should be stripped
    let shouldStrip = false;
    let segmentInfo = { marker: `0x${marker.toString(16).toUpperCase()}`, length };
    
    // Map marker to name
    const markerNames = {
      0xE0: 'APP0 (JFIF)',
      0xE1: 'APP1 (EXIF/XMP)',
      0xE2: 'APP2 (ICC Profile)',
      0xED: 'APP13 (Photoshop)',
      0xFE: 'COM (Comment)'
    };
    segmentInfo.name = markerNames[marker] || `APP${marker - 0xE0}`;
    
    if (STRIP_JPEG_MARKERS.includes(marker)) {
      // Check content for ComfyUI indicators
      const content = data.slice(offset + 4, offset + 2 + length);
      const textContent = new TextDecoder('utf-8', { fatal: false }).decode(content);
      
      // Look for JSON or ComfyUI indicators
      if (textContent.includes('{') && 
          (textContent.includes('prompt') || textContent.includes('workflow') ||
           textContent.includes('class_type') || textContent.includes('ComfyUI'))) {
        shouldStrip = true;
        try {
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const json = JSON.parse(jsonMatch[0]);
            segmentInfo.jsonPreview = JSON.stringify(json, null, 2).slice(0, 500) + '...';
          }
        } catch (e) {
          segmentInfo.jsonPreview = textContent.slice(0, 200) + '...';
        }
      }
      
      // Also strip if it's a comment that looks like metadata
      if (marker === 0xFE && textContent.length > 0) {
        if (textContent.includes('{') || textContent.includes('ComfyUI')) {
          shouldStrip = true;
          segmentInfo.content = textContent.slice(0, 200);
        }
      }
    }
    
    if (shouldStrip) {
      removedSegments.push(segmentInfo);
    } else {
      segments.push(segmentData);
    }
    
    offset += 2 + length;
  }
  
  // Reassemble JPEG
  const totalSize = segments.reduce((acc, s) => acc + s.length, 0);
  const cleanedBuffer = new ArrayBuffer(totalSize);
  const cleanedData = new Uint8Array(cleanedBuffer);
  
  let writeOffset = 0;
  for (const segment of segments) {
    cleanedData.set(segment, writeOffset);
    writeOffset += segment.length;
  }
  
  return {
    cleanedBuffer,
    removedSegments,
    isModified: removedSegments.length > 0
  };
}

/**
 * Detect image type from buffer
 * @param {ArrayBuffer} buffer 
 * @returns {'png' | 'jpeg' | 'unknown'}
 */
function detectImageType(buffer) {
  const data = new Uint8Array(buffer);
  
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return 'png';
  }
  
  // JPEG signature: FF D8 FF
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return 'jpeg';
  }
  
  return 'unknown';
}

/**
 * ComfyImageStripper - Main component
 */
export function ComfyImageStripper({ 
  onImageProcessed,
  showPreview = true,
  className = ''
}) {
  const [originalFile, setOriginalFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState(null);
  const [cleanedBlob, setCleanedBlob] = useState(null);
  const [cleanedUrl, setCleanedUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const fileInputRef = useRef(null);

  const processImage = useCallback(async (file) => {
    setProcessing(true);
    setError(null);
    setStats(null);
    
    try {
      const buffer = await file.arrayBuffer();
      const imageType = detectImageType(buffer);
      
      if (imageType === 'unknown') {
        throw new Error('Unsupported image format. Please upload a PNG or JPEG file.');
      }
      
      let result;
      let mimeType;
      
      if (imageType === 'png') {
        result = stripPngMetadata(buffer);
        mimeType = 'image/png';
        setStats({
          type: 'PNG',
          originalSize: buffer.byteLength,
          cleanedSize: result.cleanedBuffer.byteLength,
          removedItems: result.removedChunks,
          isModified: result.isModified
        });
      } else {
        result = stripJpegMetadata(buffer);
        mimeType = 'image/jpeg';
        setStats({
          type: 'JPEG',
          originalSize: buffer.byteLength,
          cleanedSize: result.cleanedBuffer.byteLength,
          removedItems: result.removedSegments,
          isModified: result.isModified
        });
      }
      
      const blob = new Blob([result.cleanedBuffer], { type: mimeType });
      
      // Clean up previous URLs
      if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
      if (originalUrl) URL.revokeObjectURL(originalUrl);
      
      const newOriginalUrl = URL.createObjectURL(file);
      const newCleanedUrl = URL.createObjectURL(blob);
      
      setOriginalFile(file);
      setOriginalUrl(newOriginalUrl);
      setCleanedBlob(blob);
      setCleanedUrl(newCleanedUrl);
      
      if (onImageProcessed) {
        onImageProcessed({
          original: file,
          cleaned: blob,
          stats: result
        });
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  }, [cleanedUrl, originalUrl, onImageProcessed]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  }, [processImage]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
  }, [processImage]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDownload = useCallback(() => {
    if (!cleanedBlob || !originalFile) return;
    
    const link = document.createElement('a');
    link.href = cleanedUrl;
    
    // Generate new filename
    const originalName = originalFile.name;
    const lastDot = originalName.lastIndexOf('.');
    const baseName = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
    const extension = lastDot > 0 ? originalName.slice(lastDot) : '.png';
    link.download = `${baseName}_stripped${extension}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [cleanedBlob, cleanedUrl, originalFile]);

  const handleReset = useCallback(() => {
    if (cleanedUrl) URL.revokeObjectURL(cleanedUrl);
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    
    setOriginalFile(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setStats(null);
    setError(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [cleanedUrl, originalUrl]);

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={`comfy-stripper ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      {!originalFile ? (
        <div
          className="drop-zone"
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="drop-zone-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p>Drop image here or click to upload</p>
            <span>Supports PNG and JPEG from ComfyUI</span>
          </div>
        </div>
      ) : (
        <div className="result-container">
          {showPreview && cleanedUrl && (
            <div className="preview-section">
              <img src={cleanedUrl} alt="Cleaned preview" className="preview-image" />
            </div>
          )}
          
          {stats && (
            <div className="stats-section">
              <div className="stats-header">
                <span className="file-type">{stats.type}</span>
                <span className={`status ${stats.isModified ? 'modified' : 'clean'}`}>
                  {stats.isModified ? '✓ Metadata Removed' : '○ No ComfyUI Metadata Found'}
                </span>
              </div>
              
              <div className="stats-sizes">
                <div className="size-item">
                  <span className="label">Original</span>
                  <span className="value">{formatBytes(stats.originalSize)}</span>
                </div>
                <div className="size-item">
                  <span className="label">Cleaned</span>
                  <span className="value">{formatBytes(stats.cleanedSize)}</span>
                </div>
                <div className="size-item">
                  <span className="label">Saved</span>
                  <span className="value highlight">
                    {formatBytes(stats.originalSize - stats.cleanedSize)}
                  </span>
                </div>
              </div>
              
              {stats.removedItems.length > 0 && (
                <div className="removed-items">
                  <h4>Removed Metadata:</h4>
                  {stats.removedItems.map((item, idx) => (
                    <div key={idx} className="removed-item">
                      <span className="item-type">
                        {item.type || item.name} {item.keyword && `(${item.keyword})`}
                      </span>
                      <span className="item-size">{formatBytes(item.length)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {error && (
            <div className="error-message">
              <span>⚠️ {error}</span>
            </div>
          )}
          
          <div className="actions">
            <button 
              className="btn btn-primary"
              onClick={handleDownload}
              disabled={!cleanedBlob}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download Cleaned Image
            </button>
            <button 
              className="btn btn-secondary"
              onClick={handleReset}
            >
              Process Another
            </button>
          </div>
        </div>
      )}
      
      {processing && (
        <div className="processing-overlay">
          <div className="spinner"></div>
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
}

// Also export the utility functions for direct use
export { stripPngMetadata, stripJpegMetadata, detectImageType };

export default ComfyImageStripper;
