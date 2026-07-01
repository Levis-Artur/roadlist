import { useEffect, useState, type ReactNode } from 'react';
import { getOdometerPhoto } from '../../services/photoService';

export function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return <div><dt>{label}</dt><dd>{value ?? '—'}</dd></div>;
}

export function StoredPhoto({ photoId, alt }: { photoId?: string; alt: string }) {
  const [photo, setPhoto] = useState<string | null>();

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setPhoto(undefined);
    if (!photoId) {
      setPhoto(null);
      return () => { active = false; };
    }
    void getOdometerPhoto(photoId)
      .then((dataUrl) => {
        if (dataUrl?.startsWith('blob:')) objectUrl = dataUrl;
        if (active) setPhoto(dataUrl);
      })
      .catch(() => { if (active) setPhoto(null); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (photo === undefined) return <div className="no-photo">Завантаження фото…</div>;
  if (photo) return <img src={photo} alt={alt} onError={() => setPhoto(null)} />;
  return <div className="no-photo">{photoId ? 'Фото недоступне або було видалене.' : 'Фото відсутнє'}</div>;
}
