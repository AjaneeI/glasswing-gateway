# Asset provenance for the clean source edition

Reviewed October 16, 2026. This inventory applies to the curated `glasswing-gateway` source tree. The original private archive is a separate historical record.

| Included material                                                   | Source evidence                                                                                                                           | Distribution treatment                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Seven SVG illustrations in `public/illustrations/`                  | Backpack, Mountain, Shirt, Armchair, Laptop, Flower2 and Dumbbell from installed `lucide-react` 0.468.0; repository-authored backgrounds  | ISC copyright/permission notice reproduced exactly in third-party notices                                          |
| Integration brand paths in `components/integrations/brand-paths.ts` | All seven path sets independently compared with official Simple Icons 16.0.0: Shopify, Stripe, Adyen, Cloudflare, Vercel, GitHub, Datadog | CC0 source recorded; trademark ownership and non-endorsement remain separate                                       |
| Generic integration and sign-in icons                               | Existing Lucide library; ShoppingBag replaces the former commercetools bitmap and LockKeyhole replaces uncredited Google artwork          | Lucide notice retained                                                                                             |
| Four SVGs in `docs/assets/`                                         | Repository-created hero, architecture, shopper loop and trust-boundary diagrams from later portfolio work                                 | Included as project/team material under maintainer-confirmed publication support; no project reuse license implied |

All 11 standalone SVGs were inspected for embedded raster payloads, scripts, foreignObject and remote-resource loads; none was found. SVG namespace URLs and local gradient references are not remote images. Repository-created diagrams contain shapes and text, without embedded font files.

No JPG, PNG, WebP, GIF, video, PDF, font binary or screenshot capture is included. All five prior gallery screenshots were omitted, even though they were described as fixture captures; the release does not rely on their clearance. Test helpers can create new screenshots locally, which require review before redistribution.

The seven historic photographs, removed commercetools/Google artwork and older screenshot derivatives are not copied. No original commits, branches, tags, pull requests or `.git` object database are imported. Their unresolved historical rights remain confined to the private archive and do not clear or contaminate this separate source snapshot by reference alone.

The package lockfile records 196 dependency license declarations. Dependencies and browser/native binaries are installed by the recipient rather than vendored. See [third-party notices](../THIRD_PARTY_NOTICES.md) and the [dependency inventory](dependency-licenses.json). This review establishes documented sources and distribution scope; it is not an independent legal opinion or a trademark license.

Official references: [Lucide source](https://github.com/lucide-icons/lucide), [Lucide license](https://lucide.dev/license), [Simple Icons 16.0.0 source](https://github.com/simple-icons/simple-icons/tree/16.0.0/icons), [Simple Icons license](https://github.com/simple-icons/simple-icons/blob/16.0.0/LICENSE.md).
