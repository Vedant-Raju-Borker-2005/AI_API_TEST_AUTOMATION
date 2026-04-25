import React from 'react';

/**
 * UploadZone — drag-and-drop / click-to-upload file input area.
 *
 * Props:
 * @param {React.Ref}  inputRef    - Ref attached to the hidden <input type="file">
 * @param {string}     accept      - MIME / extension filter for the input
 * @param {Function}   onChange    - Native input onChange handler
 * @param {Function}   onDrop      - Called with the native DragEvent when a file is dropped
 * @param {boolean}    dragOver    - Whether a drag is currently active over the zone
 * @param {Function}   setDragOver - Setter for dragOver state
 * @param {boolean}    uploading   - True while an upload is in-flight
 * @param {string}     icon        - Emoji icon to display in idle state
 * @param {string}     title       - Primary label
 * @param {string}     subtitle    - Secondary label / status line
 * @param {boolean}    disabled    - Prevents interaction entirely
 */
export default function UploadZone({
  inputRef, accept, onChange, onDrop,
  dragOver, setDragOver,
  uploading, icon, title, subtitle, disabled,
}) {
  return (
    <div
      className={[
        'upload-zone',
        dragOver  ? 'drag-over'  : '',
        uploading ? 'uploading'  : '',
      ].filter(Boolean).join(' ')}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !uploading && !disabled && inputRef.current?.click()}
      onKeyDown={(e) =>
        !uploading && !disabled &&
        (e.key === 'Enter' || e.key === ' ') &&
        inputRef.current?.click()
      }
      onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!uploading) onDrop(e); }}
      style={{ cursor: uploading ? 'wait' : disabled ? 'not-allowed' : 'pointer' }}
    >
      <div className="upload-icon">{uploading ? '⏳' : icon}</div>
      <div><strong>{uploading ? 'Processing…' : title}</strong></div>
      <div className="upload-sub">{uploading ? 'Please wait…' : subtitle}</div>
      {uploading && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" />
        </div>
      )}
    </div>
  );
}
