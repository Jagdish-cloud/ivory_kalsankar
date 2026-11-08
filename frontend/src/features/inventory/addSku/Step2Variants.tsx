import { Card } from "@/components/ui/Card";
import { ChipMultiSelect } from "@/components/ui/ChipMultiSelect";
import { ColourPicker } from "@/components/ui/ColourPicker";
import { useCreateLookup, useDeleteLookup, useLookup, useUpdateLookup } from "@/features/inventory/api";
import { isLegacyMultiVariant, type AddSkuDraft } from "@/features/inventory/addSku/types";

interface StepProps {
  draft: AddSkuDraft;
  update: (patch: Partial<AddSkuDraft>) => void;
}

export function Step2Variants({ draft, update }: StepProps) {
  const { data: sizes } = useLookup("sizes");
  const { data: cups } = useLookup("cups");
  const { data: colours } = useLookup("colours");

  const createSize = useCreateLookup("sizes");
  const updateSize = useUpdateLookup("sizes");
  const deleteSize = useDeleteLookup("sizes");

  const createCup = useCreateLookup("cups");
  const updateCup = useUpdateLookup("cups");
  const deleteCup = useDeleteLookup("cups");

  const createColour = useCreateLookup("colours");
  const updateColour = useUpdateLookup("colours");
  const deleteColour = useDeleteLookup("colours");

  // Styles created before the "one combination per SKU" rule can still hold several variants.
  // They are shown read-only so editing them can never delete or merge variants by accident.
  if (isLegacyMultiVariant(draft)) {
    const sizeLabels = (sizes ?? []).filter((s) => draft.sizeIds.includes(s.id)).map((s) => s.label);
    const cupLabels = (cups ?? []).filter((c) => draft.cupIds.includes(c.id)).map((c) => c.label);
    const colourNames = (colours ?? []).filter((c) => draft.colourIds.includes(c.id)).map((c) => c.name);
    return (
      <Card>
        <h3 className="mb-1 text-sm font-bold text-ink-900">Variants</h3>
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This style was created with several size/cup/colour combinations. New SKUs allow only one combination, so
          these variants are locked here. To add another combination, create a new SKU.
        </p>
        <dl className="space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 text-ink-500">Sizes</dt>
            <dd className="font-medium text-ink-900">{sizeLabels.join(", ") || "-"}</dd>
          </div>
          {cupLabels.length > 0 && (
            <div className="flex gap-2">
              <dt className="w-20 text-ink-500">Cups</dt>
              <dd className="font-medium text-ink-900">{cupLabels.join(", ")}</dd>
            </div>
          )}
          <div className="flex gap-2">
            <dt className="w-20 text-ink-500">Colours</dt>
            <dd className="font-medium text-ink-900">{colourNames.join(", ") || "-"}</dd>
          </div>
        </dl>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-1 text-sm font-bold text-ink-900">Variant</h3>
      <p className="mb-5 text-xs text-ink-500">
        Each SKU has exactly one size, one colour and (optionally) one cup. Create another SKU for every other
        combination.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChipMultiSelect
          single
          label="Size"
          hint="Pick the band / garment size"
          required
          options={(sizes ?? []).map((s) => ({ id: s.id, label: s.label ?? "" }))}
          selectedIds={draft.sizeIds}
          onChange={(ids) => update({ sizeIds: ids.slice(-1) })}
          addLabel="Add Size"
          onCreate={async (label) => {
            const created = await createSize.mutateAsync({ name: label });
            return { id: created.id, label: created.label ?? label };
          }}
          onRename={async (id, label) => {
            await updateSize.mutateAsync({ id, name: label });
          }}
          onDelete={async (id) => {
            await deleteSize.mutateAsync(id);
            update({ sizeIds: draft.sizeIds.filter((existing) => existing !== id) });
          }}
        />

        <ColourPicker
          single
          label="Colour"
          hint="Pick an existing colour or add a new one with its exact shade"
          required
          options={(colours ?? []).map((c) => ({ id: c.id, name: c.name ?? "", hex: c.hex }))}
          selectedIds={draft.colourIds}
          onChange={(ids) => update({ colourIds: ids.slice(-1) })}
          onCreate={async ({ name, hex }) => {
            const created = await createColour.mutateAsync({ name, hex });
            return { id: created.id, name: created.name ?? name, hex: created.hex };
          }}
          onRename={async (id, { name, hex }) => {
            await updateColour.mutateAsync({ id, name, hex });
          }}
          onDelete={async (id) => {
            await deleteColour.mutateAsync(id);
            update({ colourIds: draft.colourIds.filter((existing) => existing !== id) });
          }}
        />

        <ChipMultiSelect
          single
          label="Cup"
          hint="Optional - leave empty for products without cup sizing, e.g. panties"
          options={(cups ?? []).map((c) => ({ id: c.id, label: c.label ?? "" }))}
          selectedIds={draft.cupIds}
          onChange={(ids) => update({ cupIds: ids.slice(-1) })}
          addLabel="Add Cup"
          onCreate={async (label) => {
            const created = await createCup.mutateAsync({ name: label });
            return { id: created.id, label: created.label ?? label };
          }}
          onRename={async (id, label) => {
            await updateCup.mutateAsync({ id, name: label });
          }}
          onDelete={async (id) => {
            await deleteCup.mutateAsync(id);
            update({ cupIds: draft.cupIds.filter((existing) => existing !== id) });
          }}
        />
      </div>
    </Card>
  );
}
