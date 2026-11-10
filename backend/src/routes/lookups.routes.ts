import { Router } from "express";
import { brands, categories, colours, cups, sareeOptions, sizes, subCategories, suppliers } from "@/controllers/lookups.controller";
import { asyncHandler } from "@/utils/asyncHandler";

const router = Router();

router.get("/brands", asyncHandler(brands.list));
router.post("/brands", asyncHandler(brands.create));
router.patch("/brands/:id", asyncHandler(brands.update));
router.delete("/brands/:id", asyncHandler(brands.remove));

router.get("/categories", asyncHandler(categories.list));
router.post("/categories", asyncHandler(categories.create));
router.patch("/categories/:id", asyncHandler(categories.update));
router.delete("/categories/:id", asyncHandler(categories.remove));

router.get("/sub-categories", asyncHandler(subCategories.list));
router.post("/sub-categories", asyncHandler(subCategories.create));
router.patch("/sub-categories/:id", asyncHandler(subCategories.update));
router.delete("/sub-categories/:id", asyncHandler(subCategories.remove));

router.get("/sizes", asyncHandler(sizes.list));
router.post("/sizes", asyncHandler(sizes.create));
router.patch("/sizes/:id", asyncHandler(sizes.update));
router.delete("/sizes/:id", asyncHandler(sizes.remove));

router.get("/cups", asyncHandler(cups.list));
router.post("/cups", asyncHandler(cups.create));
router.patch("/cups/:id", asyncHandler(cups.update));
router.delete("/cups/:id", asyncHandler(cups.remove));

router.get("/colours", asyncHandler(colours.list));
router.post("/colours", asyncHandler(colours.create));
router.patch("/colours/:id", asyncHandler(colours.update));
router.delete("/colours/:id", asyncHandler(colours.remove));

router.get("/saree-options", asyncHandler(sareeOptions.list));
router.post("/saree-options", asyncHandler(sareeOptions.create));
router.patch("/saree-options/:id", asyncHandler(sareeOptions.update));
router.delete("/saree-options/:id", asyncHandler(sareeOptions.remove));

router.get("/suppliers", asyncHandler(suppliers.list));
router.post("/suppliers", asyncHandler(suppliers.create));
router.patch("/suppliers/:id", asyncHandler(suppliers.update));
router.delete("/suppliers/:id", asyncHandler(suppliers.remove));

export default router;
