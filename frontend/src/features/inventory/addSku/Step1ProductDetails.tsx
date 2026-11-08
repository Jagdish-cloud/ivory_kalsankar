import { useRef, useState } from "react";
import { ImagePlus, Video, X } from "lucide-react";
import { WebcamCaptureModal } from "@/components/ui/WebcamCaptureModal";
import { Card } from "@/components/ui/Card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { SelectOrCreateField } from "@/components/ui/SelectOrCreateField";
import { Toggle } from "@/components/ui/Checkbox";
import {
  useCategories,
  useCreateLookup,
  useDeleteLookup,
  useLookup,
  useUpdateLookup,
} from "@/features/inventory/api";
import type { AddSkuDraft, StagedImage } from "@/features/inventory/addSku/types";

const IMAGE_SLOTS = ["Front", "Back", "Side", "Inside", "Strap Close-up", "Hook & Eye", "Fabric Close-up"];

interface StepProps {
  draft: AddSkuDraft;
  update: (patch: Partial<AddSkuDraft>) => void;
}

const selectOptions = {
  padded: ["Padded", "Non Padded", "Lightly Padded"],
  wired: ["Wired", "Non Wired"],
  cupConstruction: ["Moulded", "Seamless Moulded", "Cut & Sew", "Lace"],
  numberOfPanels: ["1 Panel", "2 Panel", "3 Panel", "4 Panel"],
  coverage: ["Full Coverage", "Medium Coverage", "Partial Coverage"],
  strapType: ["Regular", "Racerback", "Detachable", "Halter"],
  adjustableStraps: ["Yes", "No"],
  removableStraps: ["Yes", "No"],
  hookAndEye: ["2 Hook", "3 Hook", "4 Hook", "No Hook"],
  elasticType: ["Soft Elastic", "Regular Elastic"],
  seamType: ["Flat Seam", "Overlock Seam", "Seamless"],
  finish: ["Soft Touch", "Matte", "Glossy"],
  washCare: ["Hand Wash", "Machine Wash Cold", "Dry Clean"],
};

export function Step1ProductDetails({ draft, update }: StepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const draftImagesRef = useRef(draft.images);
  draftImagesRef.current = draft.images;
  const { data: brands } = useLookup("brands");
  const { data: categories } = useCategories();

  const createBrand = useCreateLookup("brands");
  const updateBrand = useUpdateLookup("brands");
  const deleteBrand = useDeleteLookup("brands");

  const createCategory = useCreateLookup("categories");
  const updateCategory = useUpdateLookup("categories");
  const deleteCategory = useDeleteLookup("categories");

  const createSubCategory = useCreateLookup("sub-categories");
  const updateSubCategory = useUpdateLookup("sub-categories");
  const deleteSubCategory = useDeleteLookup("sub-categories");

  const selectedCategory = categories?.find((c) => c.id === draft.categoryId);
  const subCategoryOptions = (selectedCategory?.subCategories ?? []).map((s) => ({ id: s.id, label: s.name }));

  function setSpec<K extends keyof AddSkuDraft["specification"]>(key: K, value: AddSkuDraft["specification"][K]) {
    update({ specification: { ...draft.specification, [key]: value } });
  }

  function setOther<K extends keyof AddSkuDraft["other"]>(key: K, value: AddSkuDraft["other"][K]) {
    update({ other: { ...draft.other, [key]: value } });
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const newImages: StagedImage[] = Array.from(files).map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
      imageType: IMAGE_SLOTS[draft.images.length + index] ?? "Other",
    }));
    update({ images: [...draft.images, ...newImages] });
  }

  function addWebcamFile(file: File) {
    // functional update so several shots taken in one session all land in the draft
    update({
      images: [
        ...draftImagesRef.current,
        {
          id: `${Date.now()}-cam`,
          file,
          previewUrl: URL.createObjectURL(file),
          imageType: IMAGE_SLOTS[draftImagesRef.current.length] ?? "Other",
        },
      ],
    });
  }

  function removeImage(id: string) {
    update({ images: draft.images.filter((img) => img.id !== id) });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <h3 className="mb-4 text-sm font-bold text-ink-900">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <SelectOrCreateField
            label="Brand"
            required
            placeholder="Select brand"
            addLabel="Add new brand"
            options={(brands ?? []).map((b) => ({ id: b.id, label: b.name ?? "" }))}
            value={draft.brandId}
            onChange={(id) => update({ brandId: id })}
            onCreate={async (name) => {
              const created = await createBrand.mutateAsync({ name });
              return { id: created.id, label: created.name ?? name };
            }}
            onRename={async (id, name) => {
              await updateBrand.mutateAsync({ id, name });
            }}
            onDelete={async (id) => {
              await deleteBrand.mutateAsync(id);
            }}
          />

          <SelectOrCreateField
            label="Category"
            required
            placeholder="Select category"
            addLabel="Add new category"
            options={(categories ?? []).map((c) => ({ id: c.id, label: c.name }))}
            value={draft.categoryId}
            onChange={(id) => update({ categoryId: id, subCategoryId: "" })}
            onCreate={async (name) => {
              const created = await createCategory.mutateAsync({ name });
              return { id: created.id, label: created.name ?? name };
            }}
            onRename={async (id, name) => {
              await updateCategory.mutateAsync({ id, name });
            }}
            onDelete={async (id) => {
              await deleteCategory.mutateAsync(id);
            }}
          />

          <SelectOrCreateField
            label="Sub Category"
            placeholder="Select sub category"
            addLabel="Add new sub category"
            disabled={!selectedCategory}
            options={subCategoryOptions}
            value={draft.subCategoryId}
            onChange={(id) => update({ subCategoryId: id })}
            onCreate={async (name) => {
              if (!selectedCategory) return;
              const created = await createSubCategory.mutateAsync({ name, categoryId: selectedCategory.id });
              return { id: created.id, label: created.name ?? name };
            }}
            onRename={async (id, name) => {
              await updateSubCategory.mutateAsync({ id, name });
            }}
            onDelete={async (id) => {
              await deleteSubCategory.mutateAsync(id);
            }}
          />

          <TextField
            label="Product / Style Name"
            required
            value={draft.styleName}
            onChange={(e) => update({ styleName: e.target.value })}
            placeholder="e.g. T-Shirt Bra"
          />

          <TextField
            label="Supplier Style Code"
            required
            value={draft.supplierStyleCode}
            onChange={(e) => update({ supplierStyleCode: e.target.value })}
          />
          <TextField
            label="Internal Style Code"
            required
            value={draft.internalStyleCode}
            onChange={(e) => update({ internalStyleCode: e.target.value })}
            placeholder="e.g. IL-BR-1723"
          />

          <TextField
            label="HSN Code"
            value={draft.hsnCode}
            onChange={(e) => update({ hsnCode: e.target.value })}
          />
          <TextField
            label="Country of Origin"
            value={draft.countryOfOrigin}
            onChange={(e) => update({ countryOfOrigin: e.target.value })}
          />

          <TextField
            label="Launch Date"
            type="date"
            value={draft.launchDate}
            onChange={(e) => update({ launchDate: e.target.value })}
          />
        </div>

        <div className="mt-4">
          <TextAreaField
            label="Description"
            rows={3}
            maxLength={200}
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            hint={`${draft.description.length}/200`}
          />
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-sm font-bold text-ink-900">Product Images</h3>
        <p className="mb-3 text-xs text-ink-500">
          Optional - Min. 5 images recommended. Upload files or take photos with your camera.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {draft.images.map((img) => (
            <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border border-brand-100">
              <img src={img.previewUrl} alt={img.imageType} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute bottom-0 w-full bg-black/50 px-1 py-0.5 text-center text-[9px] text-white">
                {img.imageType}
              </span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-200 text-brand-400 hover:border-brand-400 hover:bg-brand-50"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </button>
          <button
            type="button"
            onClick={() => setWebcamOpen(true)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-200 text-brand-400 hover:border-brand-400 hover:bg-brand-50"
          >
            <Video className="h-5 w-5" />
            <span className="text-[10px] font-medium">Camera</span>
          </button>
        </div>
        <WebcamCaptureModal open={webcamOpen} onClose={() => setWebcamOpen(false)} onCapture={addWebcamFile} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="mt-3 text-[11px] text-ink-500">Supported formats: JPG, PNG. Max size: 5MB per image.</p>
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="mb-4 text-sm font-bold text-ink-900">Product Specifications</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <SelectField label="Padded / Non-Padded" placeholder="Select" value={draft.specification.padded} onChange={(e) => setSpec("padded", e.target.value)}>
            {selectOptions.padded.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Wired / Non-Wired" placeholder="Select" value={draft.specification.wired} onChange={(e) => setSpec("wired", e.target.value)}>
            {selectOptions.wired.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Cup Construction" placeholder="Select" value={draft.specification.cupConstruction} onChange={(e) => setSpec("cupConstruction", e.target.value)}>
            {selectOptions.cupConstruction.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Number of Panels" placeholder="Select" value={draft.specification.numberOfPanels} onChange={(e) => setSpec("numberOfPanels", e.target.value)}>
            {selectOptions.numberOfPanels.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Coverage" placeholder="Select" value={draft.specification.coverage} onChange={(e) => setSpec("coverage", e.target.value)}>
            {selectOptions.coverage.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Strap Type" placeholder="Select" value={draft.specification.strapType} onChange={(e) => setSpec("strapType", e.target.value)}>
            {selectOptions.strapType.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <TextField label="Strap Width" placeholder="e.g. 20mm" value={draft.specification.strapWidth} onChange={(e) => setSpec("strapWidth", e.target.value)} />
          <SelectField label="Adjustable Straps" placeholder="Select" value={draft.specification.adjustableStraps} onChange={(e) => setSpec("adjustableStraps", e.target.value)}>
            {selectOptions.adjustableStraps.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Removable Straps" placeholder="Select" value={draft.specification.removableStraps} onChange={(e) => setSpec("removableStraps", e.target.value)}>
            {selectOptions.removableStraps.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Hook & Eye" placeholder="Select" value={draft.specification.hookAndEye} onChange={(e) => setSpec("hookAndEye", e.target.value)}>
            {selectOptions.hookAndEye.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <TextField label="Underband Width" placeholder="e.g. 32mm" value={draft.specification.underbandWidth} onChange={(e) => setSpec("underbandWidth", e.target.value)} />
          <TextField label="Fabric Composition" placeholder="e.g. Nylon 80%, Spandex 20%" value={draft.specification.fabricComposition} onChange={(e) => setSpec("fabricComposition", e.target.value)} />
          <TextField label="Lining" placeholder="e.g. Cotton" value={draft.specification.lining} onChange={(e) => setSpec("lining", e.target.value)} />
          <TextField label="GSM (if known)" placeholder="e.g. 180 GSM" value={draft.specification.gsm} onChange={(e) => setSpec("gsm", e.target.value)} />
          <SelectField label="Elastic Type" placeholder="Select" value={draft.specification.elasticType} onChange={(e) => setSpec("elasticType", e.target.value)}>
            {selectOptions.elasticType.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <TextField label="Elastic Width" placeholder="e.g. 10mm" value={draft.specification.elasticWidth} onChange={(e) => setSpec("elasticWidth", e.target.value)} />
          <SelectField label="Seam Type" placeholder="Select" value={draft.specification.seamType} onChange={(e) => setSpec("seamType", e.target.value)}>
            {selectOptions.seamType.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Finish" placeholder="Select" value={draft.specification.finish} onChange={(e) => setSpec("finish", e.target.value)}>
            {selectOptions.finish.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
          <SelectField label="Wash Care" placeholder="Select" value={draft.specification.washCare} onChange={(e) => setSpec("washCare", e.target.value)}>
            {selectOptions.washCare.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectField>
        </div>

        <div className="mt-4">
          <TagsInput
            tags={draft.specification.tags}
            onChange={(tags) => setSpec("tags", tags)}
          />
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <h3 className="mb-4 text-sm font-bold text-ink-900">Other Information</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextField
            label="Supplier / Manufacturer"
            value={draft.other.supplierManufacturer}
            onChange={(e) => setOther("supplierManufacturer", e.target.value)}
          />
          <TextField
            label="Lead Time (Days)"
            type="number"
            value={draft.other.leadTimeDays}
            onChange={(e) => setOther("leadTimeDays", e.target.value)}
          />
          <TextField
            label="Reorder Level (Pcs)"
            type="number"
            value={draft.other.reorderLevelPcs}
            onChange={(e) => setOther("reorderLevelPcs", e.target.value)}
          />
          <TextField
            label="Shelf Location"
            value={draft.other.shelfLocation}
            onChange={(e) => setOther("shelfLocation", e.target.value)}
            placeholder="e.g. B1 - Rack 02"
          />
          <div className="flex items-end pb-1">
            <Toggle checked={draft.other.isActive} onChange={(v) => setOther("isActive", v)} label="Is Active" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function TagsInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-ink-700">Tags / Keywords</span>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 p-2">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-600">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag((e.target as HTMLInputElement).value);
            }
          }}
          placeholder="Add new tag"
          className="min-w-[100px] flex-1 border-none text-sm focus:outline-none"
        />
      </div>
      <span className="mt-1 block text-[11px] text-ink-500">Press Enter to add</span>
    </div>
  );
}
