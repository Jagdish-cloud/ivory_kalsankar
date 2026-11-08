import { SelectOrCreateField } from "@/components/ui/SelectOrCreateField";
import {
  useCreateSareeLookup,
  useDeleteSareeLookup,
  useSareeLookups,
  useUpdateSareeLookup,
} from "@/features/inventory/api";

interface Props {
  field: string;
  label: string;
  value: string;
  onChange: (name: string) => void;
  required?: boolean;
  placeholder?: string;
}

export function SareeLookupField({ field, label, value, onChange, required, placeholder = "Select" }: Props) {
  const { data: options = [] } = useSareeLookups(field);
  const create = useCreateSareeLookup();
  const rename = useUpdateSareeLookup();
  const remove = useDeleteSareeLookup();

  const items = options.map((o) => ({ id: o.id, label: o.name }));
  if (value && !options.some((o) => o.name === value)) {
    items.unshift({ id: `legacy:${value}`, label: value });
  }
  const selectedId = options.find((o) => o.name === value)?.id ?? (value ? `legacy:${value}` : "");

  return (
    <SelectOrCreateField
      label={label}
      required={required}
      placeholder={placeholder}
      addLabel="Add new"
      options={items}
      value={selectedId}
      onChange={(id) => {
        if (!id) {
          onChange("");
          return;
        }
        if (id.startsWith("legacy:")) {
          onChange(id.slice("legacy:".length));
          return;
        }
        onChange(options.find((o) => o.id === id)?.name ?? "");
      }}
      onCreate={async (name) => {
        const created = await create.mutateAsync({ field, name });
        onChange(created.name);
        return { id: created.id, label: created.name };
      }}
      onRename={async (id, name) => {
        if (id.startsWith("legacy:")) return;
        await rename.mutateAsync({ id, name });
        onChange(name);
      }}
      onDelete={async (id) => {
        if (id.startsWith("legacy:")) {
          onChange("");
          return;
        }
        await remove.mutateAsync(id);
      }}
    />
  );
}
