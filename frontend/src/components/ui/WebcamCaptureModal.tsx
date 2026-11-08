import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface WebcamCaptureModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with a JPEG file for every accepted shot. The modal can stay open to take several photos. */
  onCapture: (file: File) => void;
}

/**
 * Optional webcam capture. Nothing here is required - if the camera is missing or blocked the user
 * is told and can simply upload files instead.
 */
export function WebcamCaptureModal({ open, onClose, onCapture }: WebcamCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [captured, setCaptured] = useState(0);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const startStream = useCallback(
    async (id?: string) => {
      stopStream();
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser does not support camera access. You can upload photos instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: id ? { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 960 } } : { width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access in the browser, or upload photos instead."
            : name === "NotFoundError"
              ? "No camera was found on this device. You can upload photos instead."
              : "Could not start the camera. You can upload photos instead."
        );
      }
    },
    [stopStream]
  );

  useEffect(() => {
    if (open) {
      setShot(null);
      setCaptured(0);
      void startStream(deviceId);
    } else {
      stopStream();
    }
    return stopStream;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url);
    };
  }, [shot]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) setShot({ blob, url: URL.createObjectURL(blob) });
      },
      "image/jpeg",
      0.9
    );
  }

  function usePhoto() {
    if (!shot) return;
    onCapture(new File([shot.blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" }));
    setCaptured((n) => n + 1);
    setShot(null);
  }

  function switchCamera() {
    if (devices.length < 2) return;
    const index = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(index + 1) % devices.length];
    setDeviceId(next.deviceId);
    void startStream(next.deviceId);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Take photo with camera"
      description="Optional - you can also upload image files instead."
      footer={
        <>
          {captured > 0 && <span className="mr-auto text-xs text-emerald-600">{captured} photo(s) added</span>}
          {shot ? (
            <>
              <Button variant="secondary" onClick={() => setShot(null)}>
                <RefreshCw className="h-4 w-4" /> Retake
              </Button>
              <Button onClick={usePhoto}>Use this photo</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>
                {captured > 0 ? "Done" : "Cancel"}
              </Button>
              {devices.length > 1 && (
                <Button variant="secondary" onClick={switchCamera} disabled={!ready}>
                  <SwitchCamera className="h-4 w-4" /> Switch camera
                </Button>
              )}
              <Button onClick={takePhoto} disabled={!ready}>
                <Camera className="h-4 w-4" /> Capture
              </Button>
            </>
          )}
        </>
      }
    >
      {error ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</p>
      ) : (
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink-900">
          <video ref={videoRef} playsInline muted className={shot ? "hidden" : "h-full w-full object-cover"} />
          {shot && <img src={shot.url} alt="Captured" className="h-full w-full object-cover" />}
          {!ready && !shot && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Starting camera...</div>
          )}
        </div>
      )}
    </Modal>
  );
}
