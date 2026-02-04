# ComfyUI Workflow Cleaner JSX

A lightweight React component for removing embedded workflow and prompt metadata from ComfyUI-generated images. Non-destructive processing ensures your image data is never touched — only metadata chunks are stripped.

Live Demo: https://scuffedepoch.com/image-cleaner/

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/react-16.8%2B-61dafb.svg)

---

## What It Does

When ComfyUI generates images, it embeds JSON metadata containing the complete workflow, prompts, and node configurations directly into the image file. This is useful for reproducibility but can be problematic when sharing images publicly — it reveals your entire generation process, custom prompts, and potentially sensitive workflow details.

**ComfyUI Workflow Cleaner JSX** surgically removes this embedded metadata while preserving image quality:

| Format | Metadata Location | What's Removed |
|--------|-------------------|----------------|
| **PNG** | `tEXt`, `iTXt`, `zTXt` chunks | `prompt`, `workflow`, `parameters` keys |
| **JPEG** | APP1 (EXIF), APP13, COM segments | ComfyUI-related JSON data |

The component operates entirely client-side — no server uploads, no external dependencies beyond React.

---

## Quick Preview

Want to see it in action immediately? Open **`demo.html`** in any modern browser:

```bash
# Clone the repository
git clone https://github.com/MushroomFleet/ComfyUI-workflow-cleaner-JSX.git

# Open the demo
open demo.html
# or on Windows:
start demo.html
# or on Linux:
xdg-open demo.html
```

The demo is a self-contained HTML file with inline React/Babel — no build step required. Simply drag and drop a ComfyUI image to strip its metadata.

---

## Features

- **Non-destructive processing** — Image pixel data is never modified
- **Dual format support** — Handles both PNG and JPEG from ComfyUI
- **Zero dependencies** — Only requires React 16.8+
- **Client-side only** — No server uploads, works offline
- **Detailed statistics** — Shows exactly what was removed and bytes saved
- **Flexible integration** — Use as a component or import utility functions directly

---

## Installation

### Option 1: Copy the Component

Download `comfyimage-stripper.jsx` and add it to your project:

```
src/
├── components/
│   └── comfyimage-stripper.jsx
```

### Option 2: Clone the Repository

```bash
git clone https://github.com/MushroomFleet/ComfyUI-workflow-cleaner-JSX.git
```

---

## Basic Usage

```jsx
import React from 'react';
import { ComfyImageStripper } from './components/comfyimage-stripper';

function App() {
  const handleProcessed = ({ original, cleaned, stats }) => {
    console.log(`Removed ${stats.removedItems.length} metadata chunks`);
    console.log(`Saved ${stats.originalSize - stats.cleanedSize} bytes`);
  };

  return (
    <ComfyImageStripper 
      onImageProcessed={handleProcessed}
      showPreview={true}
    />
  );
}
```

### Using Utility Functions Directly

For programmatic use without the UI:

```jsx
import { stripPngMetadata, stripJpegMetadata, detectImageType } from './comfyimage-stripper';

async function cleanImage(file) {
  const buffer = await file.arrayBuffer();
  const type = detectImageType(buffer);
  
  const result = type === 'png' 
    ? stripPngMetadata(buffer) 
    : stripJpegMetadata(buffer);
  
  return new Blob([result.cleanedBuffer], { 
    type: type === 'png' ? 'image/png' : 'image/jpeg' 
  });
}
```

---

## Documentation

For comprehensive integration instructions, framework-specific examples, and advanced usage patterns, see the **[Integration Guide](ComfyUI-workflow-cleaner-JSX-integration.md)**.

The guide covers:

- Component props and callback data structures
- Styling and theming
- Next.js, Vite, Create React App, and Electron integration
- Batch processing
- Web Worker offloading
- TypeScript declarations
- Troubleshooting common issues

---

## Project Structure

```
ComfyUI-workflow-cleaner-JSX/
├── comfyimage-stripper.jsx              # Main React component
├── demo.html                            # Self-contained demo (no build required)
├── ComfyUI-workflow-cleaner-JSX-integration.md  # Developer integration guide
└── README.md                            # This file
```

---

## How It Works

### PNG Processing

PNG files store data in chunks. ComfyUI adds text chunks (`tEXt`, `iTXt`, `zTXt`) with keys like `prompt` and `workflow` containing JSON data. The stripper:

1. Parses the PNG chunk structure
2. Identifies text chunks with ComfyUI-related keywords
3. Reconstructs the file excluding those chunks
4. Preserves all image data chunks (`IDAT`) untouched

### JPEG Processing

JPEG files use marker segments. ComfyUI may store metadata in:

- **APP1** (EXIF/XMP) — Extended metadata
- **APP13** (Photoshop/IPTC) — Application-specific data
- **COM** (Comment) — Text comments

The stripper scans for segments containing ComfyUI indicators (`prompt`, `workflow`, `class_type`, `ComfyUI`) and removes only those segments.

---

## Browser Compatibility

Works in all modern browsers supporting:

- `ArrayBuffer` / `Uint8Array`
- `TextDecoder`
- `URL.createObjectURL`
- React 16.8+ (hooks)

Tested in Chrome, Firefox, Safari, and Edge.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## 📚 Citation

### Academic Citation

If you use this codebase in your research or project, please cite:

```bibtex
@software{ComfyUI_workflow_cleaner_JSX,
  title = {ComfyUI Workflow Cleaner JSX: Non-destructive metadata removal for ComfyUI images},
  author = {[Drift Johnson]},
  year = {2025},
  url = {https://github.com/MushroomFleet/ComfyUI-workflow-cleaner-JSX},
  version = {1.0.0}
}
```

### Donate:

[![Ko-Fi](https://cdn.ko-fi.com/cdn/kofi3.png?v=3)](https://ko-fi.com/driftjohnson)
