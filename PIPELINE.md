# Pipeline: Shopify Image to VRM Clothing Mesh

## Goals
- Keep swipe UI fast by using precomputed 3D assets only.
- Swap meshes on the VRM model, not just textures.
- Limit candidate items to keep generation and runtime light.

## Asset Contract
Each product that is ready for 3D gets a small manifest entry with the mesh and metadata needed to attach it.

```json
{
  "id": "shopify_12345_variant_1",
  "name": "Crew Neck Tee",
  "category": "top",
  "previewImage": "https://cdn.../preview.png",
  "ready": true,
  "mesh": {
    "lod0": "https://cdn.../mesh_lod0.glb",
    "lod1": "https://cdn.../mesh_lod1.glb",
    "type": "skinned",
    "hideMeshes": ["Body_(merged)_1"]
  }
}
```

Accessories use `type: "rigid"` and either `boneName` (raw bone name in the VRM) or `humanoidBone`.

```json
{
  "id": "shopify_98765_hat",
  "name": "Bucket Hat",
  "category": "accessory",
  "previewImage": "https://cdn.../preview.png",
  "ready": true,
  "mesh": {
    "lod0": "https://cdn.../hat.glb",
    "type": "rigid",
    "humanoidBone": "head",
    "position": [0, 0.02, 0],
    "rotation": [0, 0, 0],
    "scale": [1, 1, 1]
  }
}
```

## Offline Generation Pipeline (Precompute)
1. Ingest
   - Pull `products.json` from Shopify.
   - Deduplicate by handle and image hash.
2. Rank and limit
   - Rank by recency, price, and image quality.
   - Cap to a small N per store (8-20) to keep compute and UI fast.
3. Image cleanup
   - Pick the best front-facing image.
   - Remove background and generate a clean alpha mask.
4. 3D reconstruction
   - Generate multi-view images from the single view.
   - Reconstruct a mesh from the multi-view set.
   - For speed, use an external mesh service (default scaffold uses Meshy) and cache results.
5. Mesh cleanup
   - Remove floaters, fill holes, decimate.
   - Normalize scale and orientation to the VRM reference.
6. Rigging to VRM
   - Load the VRM base armature.
   - Transfer weights to the clothing mesh.
   - Validate skin weights and bone names.
7. Export + optimize
   - Export `glb` with skinned mesh.
   - Generate LOD0 and LOD1.
   - Apply mesh compression (Draco or meshopt).
8. Publish
   - Upload to CDN.
   - Mark `ready=true` in the manifest.

Scaffolded script: `scripts/mesh_pipeline.py` generates a mesh via an external service, rigs it with Blender, and updates a local manifest.

## Runtime Pipeline (Fast Swap)
1. Load the manifest for the current store.
2. Show only items where `ready=true`.
3. Prefetch the next and previous item meshes (LOD1).
4. On selection:
   - Hide base body meshes listed in `hideMeshes`.
   - Attach the new skinned mesh to the VRM skeleton.
   - For accessories, attach rigid meshes to an anchor bone.
5. Swap LOD1 to LOD0 once the user settles on a choice.

The swap logic is implemented in `frontend/src/webpages/CharacterStage.jsx`.

## Blender Automation (Recommended)
Use headless Blender with a script that:
- Imports the generated mesh and the VRM armature.
- Shrinkwraps and transfers weights.
- Enforces the same bone names as the VRM.
- Exports optimized `glb` files.

Example command:
```
blender --background --python scripts/rig_clothing.py -- input.glb output.glb
```

## UX and Performance Strategy
- Keep the swipe list small (8-20 items) per session.
- Always fall back to 2D previews while 3D is processing.
- Cache meshes on the client and prefetch the next item.
- Run nightly batch jobs to keep the ready pool full.
