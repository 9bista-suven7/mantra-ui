import {
  ChangeDetectionStrategy, Component, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { inject } from '@angular/core';

/** An extra input field required by a specific conversion tool */
interface ToolParam {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  placeholder: string;
  required: boolean;
}

interface ConverterTool {
  id: string;
  title: string;
  desc: string;
  icon: string;
  accept: string;
  multiple: boolean;
  endpoint: string;
  inputKey: string;    // 'file' or 'files'
  outputName: string;
  animClass: string;
  gradient: string;
  actionLabel: string; // label for the action button
  params?: ToolParam[];
}

@Component({
  selector: 'app-converter',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './converter.component.html',
  styleUrl: './converter.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConverterComponent {

  private readonly http = inject(HttpClient);

  readonly tools: ConverterTool[] = [
    // ── Existing conversions ──────────────────────────────
    {
      id: 'word-pdf', title: 'Word → PDF', desc: 'DOCX to PDF',
      icon: 'description', accept: '.docx,.doc', multiple: false,
      endpoint: '/api/convert/word-to-pdf', inputKey: 'file', outputName: 'converted.pdf',
      actionLabel: 'Convert & Download',
      animClass: 'anim-bounce', gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    },
    {
      id: 'pdf-word', title: 'PDF → Word', desc: 'PDF text to DOCX',
      icon: 'picture_as_pdf', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/pdf-to-word', inputKey: 'file', outputName: 'converted.docx',
      actionLabel: 'Convert & Download',
      animClass: 'anim-pulse', gradient: 'linear-gradient(135deg,#ef4444,#b91c1c)',
    },
    {
      id: 'img-pdf', title: 'Image → PDF', desc: 'JPG/PNG to PDF',
      icon: 'image', accept: '.jpg,.jpeg,.png', multiple: false,
      endpoint: '/api/convert/image-to-pdf', inputKey: 'file', outputName: 'converted.pdf',
      actionLabel: 'Convert & Download',
      animClass: 'anim-spin', gradient: 'linear-gradient(135deg,#22c55e,#15803d)',
    },
    {
      id: 'pdf-img', title: 'PDF → Image', desc: 'First page to JPEG',
      icon: 'photo_library', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/pdf-to-image', inputKey: 'file', outputName: 'page1.jpg',
      actionLabel: 'Convert & Download',
      animClass: 'anim-flash', gradient: 'linear-gradient(135deg,#f59e0b,#b45309)',
    },
    {
      id: 'pdf-split', title: 'Split PDF', desc: 'Every page as separate PDF',
      icon: 'call_split', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/pdf-split', inputKey: 'file', outputName: 'split_pages.zip',
      actionLabel: 'Split & Download',
      animClass: 'anim-shake', gradient: 'linear-gradient(135deg,#a855f7,#7e22ce)',
    },
    {
      id: 'pdf-merge', title: 'Merge PDFs', desc: 'Combine multiple PDFs',
      icon: 'merge_type', accept: '.pdf', multiple: true,
      endpoint: '/api/convert/pdf-merge', inputKey: 'files', outputName: 'merged.pdf',
      actionLabel: 'Merge & Download',
      animClass: 'anim-wave', gradient: 'linear-gradient(135deg,#ec4899,#9d174d)',
    },
    // ── New features ──────────────────────────────────────
    {
      id: 'add-watermark', title: 'Add Watermark', desc: 'Diagonal text on every page',
      icon: 'water_drop', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/add-watermark', inputKey: 'file', outputName: 'watermarked.pdf',
      actionLabel: 'Add Watermark & Download',
      animClass: 'anim-wave', gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)',
      params: [{ key: 'text', label: 'Watermark text', type: 'text', placeholder: 'CONFIDENTIAL', required: true }],
    },
    {
      id: 'remove-watermark', title: 'Remove Watermark', desc: 'Strip watermark annotations',
      icon: 'format_color_reset', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/remove-watermark', inputKey: 'file', outputName: 'cleaned.pdf',
      actionLabel: 'Remove & Download',
      animClass: 'anim-flash', gradient: 'linear-gradient(135deg,#64748b,#334155)',
    },
    {
      id: 'lock-pdf', title: 'Lock PDF', desc: 'Password-protect a PDF',
      icon: 'lock', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/lock-pdf', inputKey: 'file', outputName: 'locked.pdf',
      actionLabel: 'Lock & Download',
      animClass: 'anim-bounce', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
      params: [{ key: 'password', label: 'Password', type: 'password', placeholder: 'Enter password', required: true }],
    },
    {
      id: 'unlock-pdf', title: 'Unlock PDF', desc: 'Remove PDF password',
      icon: 'lock_open', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/unlock-pdf', inputKey: 'file', outputName: 'unlocked.pdf',
      actionLabel: 'Unlock & Download',
      animClass: 'anim-pulse', gradient: 'linear-gradient(135deg,#10b981,#059669)',
      params: [{ key: 'password', label: 'Current password', type: 'password', placeholder: 'Enter current password', required: true }],
    },
    {
      id: 'extract-pages', title: 'Extract Pages', desc: 'Pick pages or ranges',
      icon: 'content_cut', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/extract-pages', inputKey: 'file', outputName: 'extracted.pdf',
      actionLabel: 'Extract & Download',
      animClass: 'anim-shake', gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)',
      params: [{ key: 'pages', label: 'Pages', type: 'text', placeholder: '1,3,5-8', required: true }],
    },
    {
      id: 'add-text', title: 'Add Text', desc: 'Overlay text on a page',
      icon: 'text_fields', accept: '.pdf', multiple: false,
      endpoint: '/api/convert/add-text', inputKey: 'file', outputName: 'annotated.pdf',
      actionLabel: 'Add Text & Download',
      animClass: 'anim-bounce', gradient: 'linear-gradient(135deg,#ec4899,#be185d)',
      params: [
        { key: 'text', label: 'Text to add', type: 'text', placeholder: 'Your text here', required: true },
        { key: 'page', label: 'Page number', type: 'number', placeholder: '1', required: true },
      ],
    },
  ];

  readonly activeTool   = signal<ConverterTool | null>(null);
  readonly selectedFiles = signal<File[]>([]);
  readonly converting   = signal(false);
  readonly progress     = signal(0);
  readonly error        = signal<string | null>(null);
  readonly isDragOver   = signal(false);
  readonly paramValues  = signal<Record<string, string>>({});

  /** True when all required params have a non-empty value. */
  readonly paramsReady = computed(() => {
    const tool = this.activeTool();
    if (!tool?.params) return true;
    const vals = this.paramValues();
    return tool.params.every(p => !p.required || !!vals[p.key]?.trim());
  });

  select(tool: ConverterTool): void {
    this.activeTool.set(tool);
    this.selectedFiles.set([]);
    this.error.set(null);
    this.progress.set(0);
    this.isDragOver.set(false);
    this.paramValues.set({});
  }

  back(): void {
    this.activeTool.set(null);
    this.selectedFiles.set([]);
    this.error.set(null);
    this.progress.set(0);
    this.isDragOver.set(false);
    this.paramValues.set({});
  }

  setParam(key: string, value: string): void {
    this.paramValues.update(prev => ({ ...prev, [key]: value }));
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.addFiles(Array.from(input.files));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) this.addFiles(Array.from(files));
  }

  removeFile(index: number): void {
    const copy = [...this.selectedFiles()];
    copy.splice(index, 1);
    this.selectedFiles.set(copy);
  }

  private addFiles(incoming: File[]): void {
    const tool = this.activeTool();
    if (!tool) return;
    this.selectedFiles.set(tool.multiple ? [...this.selectedFiles(), ...incoming] : [incoming[0]]);
    this.error.set(null);
  }

  convert(): void {
    const tool  = this.activeTool();
    const files = this.selectedFiles();
    if (!tool || !files.length || !this.paramsReady()) return;

    const form = new FormData();
    if (tool.multiple) {
      files.forEach(f => form.append('files', f));
    } else {
      form.append('file', files[0]);
    }
    // Append extra params
    const vals = this.paramValues();
    Object.keys(vals).forEach(k => { if (vals[k]) form.append(k, vals[k]); });

    this.converting.set(true);
    this.progress.set(0);
    this.error.set(null);

    this.http.post(tool.endpoint, form, {
      responseType: 'blob',
      reportProgress: true,
      observe: 'events',
    }).subscribe({
      next: event => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round(100 * event.loaded / event.total));
        } else if (event.type === HttpEventType.Response) {
          const blob = event.body as Blob;
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href = url;
          a.download = tool.outputName;
          a.click();
          URL.revokeObjectURL(url);
          this.converting.set(false);
          this.progress.set(100);
        }
      },
      error: (err) => {
        let msg = 'Conversion failed. Please check the file and try again.';
        const body = err?.error;
        if (body instanceof Blob) {
          // Server returned an error body as Blob (because we asked for blob).
          body.text().then(text => {
            try {
              const parsed = JSON.parse(text);
              this.error.set(parsed.message || parsed.error || msg);
            } catch {
              this.error.set(text || msg);
            }
          }).catch(() => this.error.set(msg));
        } else if (typeof body === 'string') {
          this.error.set(body || msg);
        } else if (body?.message) {
          this.error.set(body.message);
        } else {
          this.error.set(`${msg} (HTTP ${err?.status ?? '?'})`);
        }
        this.converting.set(false);
      },
    });
  }
}