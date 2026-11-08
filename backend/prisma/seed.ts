import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.upsert({
    where: { code: "UDP01" },
    update: {},
    create: {
      name: "Ivory Lace - Udupi",
      code: "UDP01",
      chain: "IVORY_LACE",
      city: "Udupi",
      firmName: "Ivory Lace Udupi",
      state: "Karnataka",
      addressLine: "Main Road",
      pincode: "576101",
    },
  });

  // Second demo branch so cross-store billing can be tried straight away.
  await prisma.store.upsert({
    where: { code: "MNP01" },
    update: {},
    create: {
      name: "Ivory Lace - Manipal",
      code: "MNP01",
      chain: "IVORY_LACE",
      city: "Manipal",
      parentId: store.id,
      firmName: "Ivory Lace Manipal",
      state: "Karnataka",
      addressLine: "Tiger Circle",
      pincode: "576104",
    },
  });

  const kalsankarUdupi = await prisma.store.upsert({
    where: { code: "KUD01" },
    update: {},
    create: {
      name: "Kalsankar OS - Udupi",
      code: "KUD01",
      chain: "KALSANKAR_OS",
      city: "Udupi",
      firmName: "Kalsankar Silk House",
      state: "Karnataka",
      addressLine: "Car Street",
      pincode: "576101",
    },
  });

  await prisma.store.upsert({
    where: { code: "KMN01" },
    update: {},
    create: {
      name: "Kalsankar OS - Manipal",
      code: "KMN01",
      chain: "KALSANKAR_OS",
      city: "Manipal",
      parentId: kalsankarUdupi.id,
      firmName: "Kalsankar Silk House Manipal",
      state: "Karnataka",
      addressLine: "Tiger Circle",
      pincode: "576104",
    },
  });

  await prisma.appSequence.upsert({
    where: { chain: "KALSANKAR_OS" },
    update: {},
    create: { chain: "KALSANKAR_OS", sareeSeq: 0 },
  });

  const passwordHash = await bcrypt.hash(process.env.SEED_USER_PASSWORD ?? "ivorylace123", 10);
  await prisma.user.upsert({
    where: { email: process.env.SEED_USER_EMAIL ?? "anjali@ivorylace.in" },
    update: {},
    create: {
      name: "Anjali S.",
      email: process.env.SEED_USER_EMAIL ?? "anjali@ivorylace.in",
      passwordHash,
      role: "MANAGER",
      storeId: store.id,
    },
  });

  // Main super admin: no home store, can create branches/sub-branches and act in any store.
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@ivorylace.in";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Super Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? "admin12345", 10),
      role: "SUPER_ADMIN",
      storeId: null,
    },
  });

  const defaultRecipient = process.env.DEFAULT_EMAIL_RECIPIENT?.trim();
  if (defaultRecipient) {
    await prisma.emailRecipient.upsert({
      where: { email: defaultRecipient },
      update: {},
      create: { email: defaultRecipient, name: "Owner" },
    });
  }
  const brands = ["Jockey", "Zivame", "Enamor", "Clovia", "PrettySecrets"];
  for (const name of brands) {
    await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
  }

  const categories: Record<string, string[]> = {
    Bra: ["T-Shirt Bra", "Push-Up Bra", "Sports Bra", "Bralette"],
    Panty: ["Hipster", "Bikini", "Boyshort"],
    "Bra & Panty Sets": ["Lace Set", "Everyday Set"],
    Camisoles: ["Basic Camisole"],
    Shapewear: ["Shaping Shorts", "Shaping Slip"],
    Nightwear: ["Nighty", "Robe"],
  };

  for (const [categoryName, subs] of Object.entries(categories)) {
    const category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
    for (const sub of subs) {
      await prisma.subCategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: sub } },
        update: {},
        create: { name: sub, categoryId: category.id },
      });
    }
  }

  const sizes = ["28", "30", "32", "34", "36", "38", "40", "S", "M", "L", "XL", "XXL", "40+"];
  for (const label of sizes) {
    await prisma.size.upsert({ where: { label }, update: {}, create: { label } });
  }

  const cups = ["A", "B", "C", "D", "DD", "E"];
  for (const label of cups) {
    await prisma.cup.upsert({ where: { label }, update: {}, create: { label } });
  }

  const colours: { name: string; hex: string }[] = [
    { name: "Black", hex: "#111111" },
    { name: "Skin", hex: "#E8B98A" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Nude Pink", hex: "#F3C6CE" },
    { name: "Maroon", hex: "#7A1F2B" },
    { name: "Grey", hex: "#9CA3AF" },
    { name: "Beige", hex: "#E8DCC8" },
  ];
  for (const colour of colours) {
    await prisma.colour.upsert({ where: { name: colour.name }, update: {}, create: colour });
  }

  const sareeLookups: Record<string, string[]> = {
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
  for (const [field, names] of Object.entries(sareeLookups)) {
    for (const name of names) {
      await prisma.sareeLookupOption.upsert({
        where: { field_name: { field, name } },
        update: {},
        create: { field, name },
      });
    }
  }

  const demoCustomers = [
    { name: "Priya Shetty", mobile: "9876543210", gender: "FEMALE" as const, city: "Udupi", isLoyaltyMember: true },
    { name: "Anitha Nayak", mobile: "8765432109", gender: "FEMALE" as const, city: "Manipal", isLoyaltyMember: true },
    { name: "Sneha Rao", mobile: "9987654321", gender: "FEMALE" as const, city: "Udupi", isLoyaltyMember: false },
    { name: "Nandini Rao", mobile: "9345678901", gender: "FEMALE" as const, city: "Kundapura", isLoyaltyMember: false },
  ];
  for (const customer of demoCustomers) {
    await prisma.customer.upsert({
      where: { mobile: customer.mobile },
      update: {},
      create: { ...customer, state: "Karnataka", storeId: store.id },
    });
  }

  console.log("Seed complete.");
  console.log(`Manager login email:     ${process.env.SEED_USER_EMAIL ?? "anjali@ivorylace.in"}`);
  console.log(`Super admin login email: ${adminEmail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
