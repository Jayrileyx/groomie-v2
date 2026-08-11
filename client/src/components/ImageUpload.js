import { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const CROP_SIZE = 300;
const OUTPUT_SIZE = 512;

export default function ImageUpload({ currentUrl, onUpload, shape = 'circle', size = '96px', label }) {
  const { token } = useAuth();
  const inputRef = useRef();
  const imgRef = useRef();
  const cropRef = useRef();
  const dragRef = useRef({ active: false, startX: 0, startY: 0, px: 0, py: 0 });

  const [preview, setPreview] = useState(currentUrl || null);
  const [imgSrc, setImgSrc] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Sync circle when parent gives a new URL
  useEffect(() => {
    if (currentUrl && currentUrl !== preview) setPreview(currentUrl);
  }, [currentUrl]);

  // Non-passive wheel listener so e.preventDefault() actually works
  useEffect(() => {
    const el = cropRef.current;
    if (!el || !imgSrc) return;
    const handler = (e) => {
      e.preventDefault();
      setScale(s => Math.max(0.2, Math.min(10, s * (1 - e.deltaY * 0.002))));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [imgSrc]);

  // Non-passive touch listener for drag (no pinch — use slider instead)
  useEffect(() => {
    const el = cropRef.current;
    if (!el || !imgSrc) return;
    const handler = (e) => {
      if (e.touches.length !== 1 || !dragRef.current.active) return;
      e.preventDefault();
      const t = e.touches[0];
      setPos({
        x: dragRef.current.px + (t.clientX - dragRef.current.startX),
        y: dragRef.current.py + (t.clientY - dragRef.current.startY),
      });
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, [imgSrc]);

  const openCrop = (file) => {
    const reader = new FileReader();
    reader.onload = ev => {
      setImgSrc(ev.target.result);
      setPos({ x: 0, y: 0 });
      setScale(1);
      setUploadError('');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) openCrop(file);
    e.target.value = '';
  };

  const onImgLoad = (e) => {
    const img = e.target;
    setScale(Math.max(CROP_SIZE / img.naturalWidth, CROP_SIZE / img.naturalHeight));
  };

  // Mouse drag
  const onMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, px: pos.x, py: pos.y };
  };
  const onMouseMove = (e) => {
    if (!dragRef.current.active) return;
    setPos({ x: dragRef.current.px + e.clientX - dragRef.current.startX, y: dragRef.current.py + e.clientY - dragRef.current.startY });
  };
  const onMouseUp = () => { dragRef.current.active = false; };

  // Touch drag start/end
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    dragRef.current = { active: true, startX: t.clientX, startY: t.clientY, px: pos.x, py: pos.y };
  };
  const onTouchEnd = () => { dragRef.current.active = false; };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;
    setUploadError('');
    setUploading(true);

    // Build canvas
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    const r = OUTPUT_SIZE / CROP_SIZE;
    ctx.drawImage(
      img,
      (CROP_SIZE / 2 + pos.x - (img.naturalWidth * scale) / 2) * r,
      (CROP_SIZE / 2 + pos.y - (img.naturalHeight * scale) / 2) * r,
      img.naturalWidth * scale * r,
      img.naturalHeight * scale * r,
    );

    // ① Show locally right away — no HTTP round-trip needed
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPreview(dataUrl);
    setImgSrc(null); // close modal now; user sees the photo immediately
    // Immediately notify parent so form/gallery has a placeholder right away.
    // onUpload(newUrl, prevUrl): prevUrl is undefined on the first call.
    onUpload(dataUrl, undefined);

    // ② Upload in background; swap to persistent server URL when done
    canvas.toBlob(async (blob) => {
      try {
        const fd = new FormData();
        fd.append('image', blob, 'photo.jpg');
        const res = await axios.post('/api/upload', fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        // Pass (serverUrl, dataUrl) so parents can replace the placeholder
        setPreview(res.data.url);
        onUpload(res.data.url, dataUrl);
      } catch {
        // Keep the dataUrl preview — placeholder already set, no further action needed
        setUploadError('Upload failed — photo shown locally but not saved to server.');
      } finally {
        setUploading(false);
      }
    }, 'image/jpeg', 0.92);
  };

  const br = shape === 'circle' ? '50%' : '8px';

  return (
    <>
      {/* ── Crop modal ── */}
      {imgSrc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
            width: '100%', maxWidth: '360px',
          }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#4338ca' }}>
              Adjust your photo
            </p>

            {/* Crop viewport */}
            <div
              ref={cropRef}
              style={{
                width: CROP_SIZE, height: CROP_SIZE, overflow: 'hidden', flexShrink: 0,
                borderRadius: shape === 'circle' ? '50%' : '10px',
                border: '3px solid #6366f1', background: '#111',
                cursor: 'grab', position: 'relative', userSelect: 'none',
              }}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove}
              onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
            >
              <img
                ref={imgRef} src={imgSrc} alt="crop" onLoad={onImgLoad} draggable={false}
                style={{
                  position: 'absolute', top: '50%', left: '50%', maxWidth: 'none',
                  transform: `translate(-50%, -50%) translate(${pos.x}px,${pos.y}px) scale(${scale})`,
                  transformOrigin: 'center', pointerEvents: 'none', userSelect: 'none',
                }}
              />
            </div>

            {/* Zoom slider */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px', color: '#9ca3af', lineHeight: 1 }}>−</span>
              <input type="range" min="0.2" max="10" step="0.01" value={scale}
                onChange={e => setScale(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#6366f1' }} />
              <span style={{ fontSize: '18px', color: '#9ca3af', lineHeight: 1 }}>+</span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
              Drag to reposition · Scroll or use slider to zoom
            </p>

            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={handleSave} style={{
                flex: 1, background: '#4f46e5', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              }}>
                Save Photo
              </button>
              <button onClick={() => setImgSrc(null)} style={{
                flex: 1, background: '#fff', color: '#6b7280', border: '1px solid #d1d5db',
                borderRadius: '8px', padding: '10px', fontSize: '14px', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Circle trigger ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div
          onClick={() => inputRef.current.click()}
          title="Click to change photo"
          style={{
            width: size, height: size, borderRadius: br,
            overflow: 'hidden', position: 'relative', cursor: 'pointer', flexShrink: 0,
            border: '2px dashed #c7d2fe', background: '#f5f3ff',
          }}
        >
          {/* Photo or placeholder */}
          {preview ? (
            <img
              src={preview}
              alt="profile"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', color: '#a5b4fc' }}>
              📷
            </div>
          )}

          {/* Hover overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(79,70,229,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0, transition: 'opacity 0.15s',
            fontSize: '11px', fontWeight: 700, color: '#fff', letterSpacing: '0.05em',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0}
          >
            CHANGE
          </div>

          {/* Uploading spinner */}
          {uploading && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', color: '#6366f1', fontWeight: 600,
            }}>
              Saving…
            </div>
          )}
        </div>

        {label && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{label}</span>}
        {uploadError && <span style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center', maxWidth: size }}>{uploadError}</span>}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>
    </>
  );
}
