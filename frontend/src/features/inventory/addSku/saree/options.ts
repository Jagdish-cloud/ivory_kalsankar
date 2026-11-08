export const SAREE_OPTIONS = {
  sareeCategory: ["Silk", "Cotton", "Linen", "Synthetic", "Blend"],
  sareeType: ["Kanchipuram", "Banarasi", "Mysore", "Paithani", "Patola", "Chanderi", "Tussar", "Organza"],
  subcategory: ["Pure silk", "Art silk", "Katan silk", "Tissue", "Cotton silk"],
  weavingTechnique: ["Handloom", "Powerloom", "Handwoven"],
  fabricComposition: ["Silk", "Cotton", "Linen", "Polyester", "Silk blend"],
  colour: ["Maroon", "Gold", "Red", "Green", "Blue", "Pink", "Purple", "Mustard", "Black", "Cream", "White"],
  secondaryColour: ["Gold", "Silver", "Maroon", "Green", "Red", "Cream", "None"],
  designPattern: ["Temple border", "Floral", "Checks", "Stripes", "Peacock", "Zari butta", "Plain"],
  borderType: ["Contrast border", "Self border", "Zari border", "Temple border"],
  palluType: ["Rich zari pallu", "Plain pallu", "Contrast pallu", "Woven pallu"],
  blousePiece: ["Included", "Not included"],
  occasion: ["Wedding", "Festival", "Party", "Casual", "Ceremonial"],
  regionOfOrigin: ["Tamil Nadu", "Karnataka", "Uttar Pradesh", "West Bengal", "Gujarat", "Maharashtra", "Andhra Pradesh"],
  productPhotographType: ["Front / Full saree", "Pallu", "Border", "Blouse piece", "Draped"],
  certification: ["Silk Mark", "Handloom Mark", "GI tag", "None"],
  stockStatus: ["Available", "Reserved", "Sold", "In transit"],
  stockCondition: ["Good", "Excellent", "Fair"],
  reservationStatus: ["Available", "Reserved"],
};

export function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

export function stockAgeLabel(dateReceived: string | null | undefined) {
  if (!dateReceived) return "0 days";
  const days = Math.max(0, Math.floor((Date.now() - new Date(dateReceived).getTime()) / 86_400_000));
  return `${days} day${days === 1 ? "" : "s"}`;
}
