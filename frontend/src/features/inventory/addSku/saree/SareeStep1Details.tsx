import { useRef, useState } from "react";
import { Camera, ImagePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/Field";
import { WebcamCaptureModal } from "@/components/ui/WebcamCaptureModal";
import { SareeLookupField } from "@/features/inventory/addSku/saree/SareeLookupField";
import type { SareeDraft } from "@/features/inventory/addSku/saree/types";

interface Props {
  draft: SareeDraft;
  update: (patch: Partial<SareeDraft>) => void;
  setSaree: <K extends keyof SareeDraft["saree"]>(key: K, value: SareeDraft["saree"][K]) => void;
  sareeId: string;
  isEdit: boolean;
  onRefreshId: () => void;
}

export function SareeStep1Details({ draft, update, setSaree, sareeId, isEdit, onRefreshId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const photoSrc = draft.photoPreview || draft.existingPhotoUrl;

  function applyPhoto(file: File) {
    if (draft.photoPreview) URL.revokeObjectURL(draft.photoPreview);
    update({
      photoFile: file,
      photoPreview: URL.createObjectURL(file),
      existingPhotoUrl: null,
    });
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-bold text-ink-900">Saree details</h3>
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <div>
          <button
            type="button"
            onClick={() => setWebcamOpen(true)}
            className="aspect-[3/4] w-full overflow-hidden rounded-xl border border-brand-100 bg-brand-50"
            aria-label={photoSrc ? "Retake photo with camera" : "Take photo with camera"}
          >
            {photoSrc ? (
              <img src={photoSrc} alt="Saree" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-400">
                <Camera className="h-8 w-8" />
                <span className="text-xs">Take a photo</span>
              </div>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) applyPhoto(file);
              e.target.value = "";
            }}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button className="w-full" size="sm" onClick={() => setWebcamOpen(true)}>
              <Camera className="h-4 w-4" /> Camera
            </Button>
            <Button variant="secondary" className="w-full" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus className="h-4 w-4" /> Upload
            </Button>
          </div>
          <WebcamCaptureModal
            open={webcamOpen}
            onClose={() => setWebcamOpen(false)}
            onCapture={applyPhoto}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <TextField label="Unique Saree ID" required value={sareeId} readOnly />
          <div className="flex items-end">
            {!isEdit && (
              <Button variant="secondary" className="mb-0.5" onClick={onRefreshId} aria-label="Refresh saree ID">
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
          <SareeLookupField
            field="sareeCategory"
            label="Saree Category"
            required
            value={draft.saree.sareeCategory}
            onChange={(name) => setSaree("sareeCategory", name)}
          />
          <SareeLookupField
            field="sareeType"
            label="Saree Type"
            value={draft.saree.sareeType ?? ""}
            onChange={(name) => setSaree("sareeType", name)}
          />
          <SareeLookupField
            field="subcategory"
            label="Subcategory"
            value={draft.saree.subcategory ?? ""}
            onChange={(name) => setSaree("subcategory", name)}
          />
          <SareeLookupField
            field="weavingTechnique"
            label="Weaving Technique"
            value={draft.saree.weavingTechnique ?? ""}
            onChange={(name) => setSaree("weavingTechnique", name)}
          />
          <SareeLookupField
            field="fabricComposition"
            label="Fabric Composition"
            value={draft.saree.fabricComposition ?? ""}
            onChange={(name) => setSaree("fabricComposition", name)}
          />
          <SareeLookupField
            field="colour"
            label="Colour"
            required
            value={draft.saree.colour}
            onChange={(name) => setSaree("colour", name)}
          />
          <SareeLookupField
            field="secondaryColour"
            label="Secondary Colour"
            value={draft.saree.secondaryColour ?? ""}
            onChange={(name) => setSaree("secondaryColour", name)}
          />
          <SareeLookupField
            field="designPattern"
            label="Design / Pattern"
            value={draft.saree.designPattern ?? ""}
            onChange={(name) => setSaree("designPattern", name)}
          />
          <SareeLookupField
            field="borderType"
            label="Border Type"
            value={draft.saree.borderType ?? ""}
            onChange={(name) => setSaree("borderType", name)}
          />
          <SareeLookupField
            field="palluType"
            label="Pallu Type"
            value={draft.saree.palluType ?? ""}
            onChange={(name) => setSaree("palluType", name)}
          />
          <SareeLookupField
            field="regionOfOrigin"
            label="Region of Origin"
            value={draft.saree.regionOfOrigin ?? ""}
            onChange={(name) => setSaree("regionOfOrigin", name)}
          />
          <SareeLookupField
            field="productPhotographType"
            label="Product Photograph"
            value={draft.saree.productPhotographType ?? ""}
            onChange={(name) => setSaree("productPhotographType", name)}
          />
          <TextField
            label="HSN Code"
            value={draft.hsnCode}
            onChange={(e) => update({ hsnCode: e.target.value })}
          />
        </div>
      </div>
    </Card>
  );
}
