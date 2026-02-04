# ComfyUI Workflow Cleaner JSX — Integration Guide

This guide walks you through integrating the `comfyimage-stripper.jsx` component into your React projects, whether you're building a web application, Electron app, or any JavaScript-based tool that needs to strip ComfyUI metadata from images.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Basic Integration](#basic-integration)
4. [Component Props](#component-props)
5. [Using Utility Functions Directly](#using-utility-functions-directly)
6. [Styling & Customization](#styling--customization)
7. [Framework-Specific Examples](#framework-specific-examples)
8. [Error Handling](#error-handling)
9. [Advanced Usage Patterns](#advanced-usage-patterns)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

The component requires React 16.8+ (for hooks support). It has no external dependencies beyond React itself.

```json
{
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  }
}
```

---

## Installation

### Option 1: Direct File Copy

Copy `comfyimage-stripper.jsx` into your project's components directory:

```
src/
├── components/
│   └── comfyimage-stripper.jsx
```

### Option 2: Via npm (if published)

```bash
npm install comfyui-workflow-cleaner-jsx
```

### Option 3: Git Submodule

```bash
git submodule add https://github.com/MushroomFleet/ComfyUI-workflow-cleaner-JSX.git lib/comfy-stripper
```

---

## Basic Integration

### Minimal Example

```jsx
import React from 'react';
import { ComfyImageStripper } from './components/comfyimage-stripper';

function App() {
  return (
    <div className="app">
      <h1>Image Metadata Cleaner</h1>
      <ComfyImageStripper />
    </div>
  );
}

export default App;
```

### With Callback Handler

```jsx
import React, { useState } from 'react';
import { ComfyImageStripper } from './components/comfyimage-stripper';

function App() {
  const [processedImage, setProcessedImage] = useState(null);

  const handleImageProcessed = ({ original, cleaned, stats }) => {
    console.log('Original file:', original.name);
    console.log('Cleaned blob size:', cleaned.size);
    console.log('Metadata removed:', stats.isModified);
    
    setProcessedImage({
      url: URL.createObjectURL(cleaned),
      savedBytes: stats.originalSize - stats.cleanedSize
    });
  };

  return (
    <div className="app">
      <ComfyImageStripper onImageProcessed={handleImageProcessed} />
      
      {processedImage && (
        <p>Saved {processedImage.savedBytes} bytes!</p>
      )}
    </div>
  );
}
```

---

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onImageProcessed` | `function` | `undefined` | Callback fired after successful processing. Receives `{ original, cleaned, stats }` |
| `showPreview` | `boolean` | `true` | Whether to display the image preview |
| `className` | `string` | `''` | Additional CSS class for the root container |

### Callback Data Structure

```typescript
interface ProcessedImageData {
  original: File;           // Original uploaded file
  cleaned: Blob;            // Cleaned image as Blob
  stats: {
    type: 'PNG' | 'JPEG';
    originalSize: number;   // Bytes
    cleanedSize: number;    // Bytes
    removedItems: Array<{
      type?: string;        // Chunk type (PNG)
      name?: string;        // Segment name (JPEG)
      keyword?: string;     // Metadata key
      length: number;       // Bytes removed
    }>;
    isModified: boolean;    // True if metadata was found and removed
  };
}
```

---

## Using Utility Functions Directly

For programmatic use without the UI component, import the utility functions:

```jsx
import { 
  stripPngMetadata, 
  stripJpegMetadata, 
  detectImageType 
} from './components/comfyimage-stripper';

async function cleanImage(file) {
  const buffer = await file.arrayBuffer();
  const imageType = detectImageType(buffer);
  
  let result;
  if (imageType === 'png') {
    result = stripPngMetadata(buffer);
  } else if (imageType === 'jpeg') {
    result = stripJpegMetadata(buffer);
  } else {
    throw new Error('Unsupported image format');
  }
  
  // Create a new file from the cleaned buffer
  const cleanedBlob = new Blob(
    [result.cleanedBuffer], 
    { type: imageType === 'png' ? 'image/png' : 'image/jpeg' }
  );
  
  return {
    blob: cleanedBlob,
    wasModified: result.isModified,
    removedChunks: result.removedChunks || result.removedSegments
  };
}
```

### Batch Processing Example

```jsx
async function batchCleanImages(files) {
  const results = [];
  
  for (const file of files) {
    try {
      const cleaned = await cleanImage(file);
      results.push({
        name: file.name,
        success: true,
        ...cleaned
      });
    } catch (error) {
      results.push({
        name: file.name,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}
```

---

## Styling & Customization

The component uses BEM-style class names for easy styling:

```css
/* Root container */
.comfy-stripper { }

/* Drop zone (upload area) */
.comfy-stripper .drop-zone { }
.comfy-stripper .drop-zone-content { }

/* Results view */
.comfy-stripper .result-container { }
.comfy-stripper .preview-section { }
.comfy-stripper .preview-image { }

/* Statistics panel */
.comfy-stripper .stats-section { }
.comfy-stripper .stats-header { }
.comfy-stripper .stats-sizes { }
.comfy-stripper .size-item { }

/* Removed metadata list */
.comfy-stripper .removed-items { }
.comfy-stripper .removed-item { }

/* Action buttons */
.comfy-stripper .actions { }
.comfy-stripper .btn { }
.comfy-stripper .btn-primary { }
.comfy-stripper .btn-secondary { }

/* States */
.comfy-stripper .processing-overlay { }
.comfy-stripper .error-message { }
```

### Custom Theme Example

```css
.comfy-stripper {
  --stripper-bg: #1a1a2e;
  --stripper-border: #16213e;
  --stripper-accent: #e94560;
  --stripper-text: #eaeaea;
  
  background: var(--stripper-bg);
  border: 2px dashed var(--stripper-border);
  border-radius: 12px;
  padding: 2rem;
}

.comfy-stripper .btn-primary {
  background: var(--stripper-accent);
  color: white;
}

.comfy-stripper .drop-zone:hover {
  border-color: var(--stripper-accent);
}
```

---

## Framework-Specific Examples

### Next.js

```jsx
// pages/cleaner.js
import dynamic from 'next/dynamic';

// Disable SSR since component uses browser APIs
const ComfyImageStripper = dynamic(
  () => import('../components/comfyimage-stripper').then(mod => mod.ComfyImageStripper),
  { ssr: false }
);

export default function CleanerPage() {
  return (
    <main>
      <ComfyImageStripper />
    </main>
  );
}
```

### Vite + React

```jsx
// src/App.jsx
import { ComfyImageStripper } from './components/comfyimage-stripper';
import './App.css';

function App() {
  return <ComfyImageStripper className="my-stripper" />;
}

export default App;
```

### Create React App

```jsx
// src/App.js
import { ComfyImageStripper } from './components/comfyimage-stripper';

function App() {
  const handleProcessed = (data) => {
    // Automatically download the cleaned image
    const link = document.createElement('a');
    link.href = URL.createObjectURL(data.cleaned);
    link.download = `cleaned_${data.original.name}`;
    link.click();
  };

  return (
    <ComfyImageStripper 
      onImageProcessed={handleProcessed}
      showPreview={true}
    />
  );
}

export default App;
```

### Electron

```jsx
// renderer/App.jsx
import { ComfyImageStripper } from './comfyimage-stripper';

function App() {
  const handleProcessed = async ({ cleaned, original }) => {
    // Use Electron's dialog to save file
    const { filePath } = await window.electron.showSaveDialog({
      defaultPath: `cleaned_${original.name}`
    });
    
    if (filePath) {
      const buffer = await cleaned.arrayBuffer();
      await window.electron.writeFile(filePath, Buffer.from(buffer));
    }
  };

  return <ComfyImageStripper onImageProcessed={handleProcessed} />;
}
```

---

## Error Handling

The component handles errors internally and displays them in the UI. For programmatic handling:

```jsx
import { stripPngMetadata, detectImageType } from './comfyimage-stripper';

async function safeCleanImage(file) {
  try {
    const buffer = await file.arrayBuffer();
    const type = detectImageType(buffer);
    
    if (type === 'unknown') {
      return { 
        success: false, 
        error: 'Unsupported format. Use PNG or JPEG.' 
      };
    }
    
    const result = type === 'png' 
      ? stripPngMetadata(buffer) 
      : stripJpegMetadata(buffer);
    
    return { 
      success: true, 
      data: result 
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Not a valid PNG file" | File header doesn't match PNG signature | Verify file is actually PNG |
| "Not a valid JPEG file" | File header doesn't match JPEG signature | Verify file is actually JPEG |
| "Unsupported image format" | File is neither PNG nor JPEG | Convert to supported format first |

---

## Advanced Usage Patterns

### Server-Side Processing (Node.js)

The utility functions work in Node.js with minor modifications:

```javascript
const fs = require('fs');
const { stripPngMetadata, detectImageType } = require('./comfyimage-stripper-node');

function cleanImageFile(inputPath, outputPath) {
  const buffer = fs.readFileSync(inputPath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset, 
    buffer.byteOffset + buffer.byteLength
  );
  
  const type = detectImageType(arrayBuffer);
  const result = type === 'png' 
    ? stripPngMetadata(arrayBuffer) 
    : stripJpegMetadata(arrayBuffer);
  
  fs.writeFileSync(outputPath, Buffer.from(result.cleanedBuffer));
  
  return result.isModified;
}
```

### Web Worker Processing

For large images, offload processing to a Web Worker:

```javascript
// worker.js
import { stripPngMetadata, stripJpegMetadata, detectImageType } from './comfyimage-stripper';

self.onmessage = async (e) => {
  const { buffer } = e.data;
  const type = detectImageType(buffer);
  
  const result = type === 'png' 
    ? stripPngMetadata(buffer) 
    : stripJpegMetadata(buffer);
  
  self.postMessage({ 
    cleanedBuffer: result.cleanedBuffer,
    isModified: result.isModified 
  }, [result.cleanedBuffer]);
};
```

```jsx
// Component usage
const worker = new Worker(new URL('./worker.js', import.meta.url));

worker.onmessage = (e) => {
  const { cleanedBuffer, isModified } = e.data;
  // Handle cleaned image
};

// Send image to worker
const buffer = await file.arrayBuffer();
worker.postMessage({ buffer }, [buffer]);
```

### Auto-Upload Integration

```jsx
function AutoCleanUploader({ uploadEndpoint }) {
  const handleProcessed = async ({ cleaned, original }) => {
    const formData = new FormData();
    formData.append('image', cleaned, original.name);
    
    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      console.log('Cleaned image uploaded successfully');
    }
  };

  return (
    <ComfyImageStripper 
      onImageProcessed={handleProcessed}
      showPreview={false}
    />
  );
}
```

---

## Troubleshooting

### Image appears corrupted after cleaning

The component only removes metadata chunks and never touches image data. If an image appears corrupted:

1. Verify the original file opens correctly
2. Check browser console for errors
3. Ensure the file isn't truncated during upload

### No metadata detected in ComfyUI image

Some scenarios where this occurs:

1. Image was re-saved in another application (Photoshop, GIMP, etc.)
2. Image was converted to a different format
3. ComfyUI workflow export was disabled
4. Image is from ComfyUI but saved without metadata option

### Component not rendering

Ensure you're importing correctly:

```jsx
// Named import (recommended)
import { ComfyImageStripper } from './comfyimage-stripper';

// Default import
import ComfyImageStripper from './comfyimage-stripper';
```

### TypeScript Support

The component is written in JSX. For TypeScript projects, create a declaration file:

```typescript
// comfyimage-stripper.d.ts
declare module './comfyimage-stripper' {
  import { FC } from 'react';
  
  interface ProcessedData {
    original: File;
    cleaned: Blob;
    stats: {
      type: 'PNG' | 'JPEG';
      originalSize: number;
      cleanedSize: number;
      removedItems: Array<{
        type?: string;
        name?: string;
        keyword?: string;
        length: number;
      }>;
      isModified: boolean;
    };
  }
  
  interface ComfyImageStripperProps {
    onImageProcessed?: (data: ProcessedData) => void;
    showPreview?: boolean;
    className?: string;
  }
  
  export const ComfyImageStripper: FC<ComfyImageStripperProps>;
  export function stripPngMetadata(buffer: ArrayBuffer): { cleanedBuffer: ArrayBuffer; removedChunks: any[]; isModified: boolean };
  export function stripJpegMetadata(buffer: ArrayBuffer): { cleanedBuffer: ArrayBuffer; removedSegments: any[]; isModified: boolean };
  export function detectImageType(buffer: ArrayBuffer): 'png' | 'jpeg' | 'unknown';
}
```

---

## Support

For issues, feature requests, or contributions, visit the [GitHub repository](https://github.com/MushroomFleet/ComfyUI-workflow-cleaner-JSX).
