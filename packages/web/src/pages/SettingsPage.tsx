import { useState, useRef } from 'react';
import { ExportData, ImportResult } from '@sprint-tracker/core';
import { useServices } from '../context/StorageContext';

export function SettingsPage() {
  const { exportService } = useServices();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    try {
      const data = await exportService.exportAll();
      await exportToFile(data);
      setMessage({ type: 'success', text: 'Data exported successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  }

  async function handleCopyToClipboard() {
    try {
      const data = await exportService.exportAll();
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setMessage({ type: 'success', text: 'Data copied to clipboard' });
    } catch (err) {
      setMessage({ type: 'error', text: `Copy failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setMessage(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportData;
      const result = await exportService.importData(data, { overwrite: false });
      setImportResult(result);

      if (result.errors.length === 0) {
        setMessage({
          type: 'success',
          text: `Imported ${result.sprints} sprints, ${result.goals} goals, ${result.criteria} criteria`,
        });
      } else if (result.sprints > 0 || result.goals > 0) {
        setMessage({ type: 'success', text: 'Import completed with some warnings' });
      } else {
        setMessage({ type: 'error', text: 'Import failed - see details below' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: `Import failed: ${err instanceof Error ? err.message : 'Invalid file'}` });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      {message && (
        <div className={`message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
        </div>
      )}

      <section className="settings-section" aria-labelledby="export-heading">
        <h3 id="export-heading">Export Data</h3>
        <p>Download all your sprint data as a JSON file. This file can be imported into another browser or the CLI version.</p>
        <div className="button-group">
          <button className="button primary" onClick={handleExport}>
            Export to File
          </button>
          <button className="button secondary" onClick={handleCopyToClipboard}>
            Copy to Clipboard
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="import-heading">
        <h3 id="import-heading">Import Data</h3>
        <p>Import sprint data from a JSON file. Existing sprints with the same ID will be skipped.</p>

        <div className="import-zone">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            disabled={importing}
            id="file-input"
            className="sr-only"
          />
          <label htmlFor="file-input" className="button primary">
            {importing ? 'Importing...' : 'Select File to Import'}
          </label>
        </div>

        {importResult && (
          <div className="import-result" aria-live="polite">
            <h4>Import Results</h4>
            <dl>
              <dt>Sprints imported:</dt>
              <dd>{importResult.sprints}</dd>
              <dt>Goals imported:</dt>
              <dd>{importResult.goals}</dd>
              <dt>Criteria imported:</dt>
              <dd>{importResult.criteria}</dd>
              <dt>Skipped:</dt>
              <dd>{importResult.skipped}</dd>
            </dl>
            {importResult.errors.length > 0 && (
              <details>
                <summary>Warnings/Errors ({importResult.errors.length})</summary>
                <ul className="error-list">
                  {importResult.errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section className="settings-section" aria-labelledby="about-heading">
        <h3 id="about-heading">About</h3>
        <p>Sprint Tracker is a lightweight tool for managing 2-week sprint cycles.</p>
        <p>Your data is stored locally in your browser using IndexedDB. No data is sent to any server.</p>
      </section>
    </div>
  );
}

// File export helper
async function exportToFile(data: ExportData): Promise<void> {
  const filename = `sprint-tracker-${new Date().toISOString().split('T')[0]}.json`;
  const json = JSON.stringify(data, null, 2);

  // Try File System Access API first (Chrome/Edge)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // User cancelled
      // Fall through to blob method
    }
  }

  // Fallback: Blob download
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
