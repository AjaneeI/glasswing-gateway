# Third-party notices

These notices cover retained third-party material. They do not license Gateway team code; see [contribution and source provenance](docs/contributions.md).

## Lucide icons and illustrations

The application uses `lucide-react` 0.468.0. Seven files under `public/illustrations/` render Backpack, Mountain, Shirt, Armchair, Laptop, Flower2 and Dumbbell from that package with archive-authored backgrounds. Generic Lucide icons replace the unverified commercetools and Google artwork.

Source: [Lucide](https://github.com/lucide-icons/lucide), [license](https://lucide.dev/license). The installed package's notice follows:

ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## Simple Icons

All seven SVG path sets in `components/integrations/brand-paths.ts` exactly matched the official [Simple Icons 16.0.0 source](https://github.com/simple-icons/simple-icons/tree/16.0.0/icons) on October 14, 2026: Shopify, Stripe, Adyen, Cloudflare, Vercel, GitHub and Datadog. Simple Icons distributes them under [CC0 1.0](https://github.com/simple-icons/simple-icons/blob/16.0.0/LICENSE.md). Brand names and marks identify services without implying endorsement, partnership or a working integration. Trademark rights are separate.

## Dependencies

Every package entry in the reviewed lockfile has license metadata. Licenses include MIT, Apache-2.0, ISC, BSD-3-Clause, 0BSD, MPL-2.0, LGPL-3.0-or-later and CC-BY-4.0, including combined expressions. This metadata inventory is not a complete transitive license opinion.

Sharp's libvips binaries carry LGPL terms, lightningcss carries MPL terms, and caniuse-lite carries CC-BY terms. Dependencies, browser binaries and build outputs are not vendored here. A future binary, container or deployed distribution needs its own notice and source-obligation review. A future MIT license for Gateway would not replace dependency terms.

## Source-only distribution scope

The seven inherited photographs, embedded commercetools bitmap, uncredited Google SVG and all screenshot captures are excluded from this clean source edition. Its Git history begins from the curated snapshot and contains none of the original archive's historical objects. See [asset provenance](docs/asset-provenance.md).

The lockfile's 196 dependency entries have version, integrity, registry source and license metadata. A generated [dependency license inventory](docs/dependency-licenses.json) records those declarations. No node_modules, Chromium binaries, libvips binaries, build output or container image is distributed here. Installation retrieves dependencies under their own licenses. Metadata is evidence of declared terms, not a complete legal opinion or permission to relicense them. Preserve applicable notices and source obligations if distributing binaries, bundles or containers later.
