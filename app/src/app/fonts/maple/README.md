# Maple Mono (brand display + mono face)

[Maple Mono](https://github.com/subframe7536/maple-font) — an open-source rounded monospace with
ligatures. Gives the Mission-Control HUD its terminal character: headings, KPIs, node names, and
every address / hash / number. Wired in `app/src/app/layout.tsx` (`--font-maple` / `--font-maple-cn`)
and pointed at by `--font-display` / `--font-mono` in `globals.css`. License: OFL-1.1.

## Files (all woff2, self-hosted)

| File | Role | Source |
|---|---|---|
| `MapleMono-{Regular,Medium,SemiBold,Bold}.woff2` | latin (400/500/600/700) | `MapleMono-Woff2.zip` (v7.9), used as-is |
| `MapleMonoCN-{Regular,Bold}.woff2` | 中文 (400/700) | `MapleMono-CN.zip` (v7.9), **subset** to the glyphs this app ships |

The CN masters are ~18 MB each; the full set is too heavy for the web. Since the app's Chinese copy
is a fixed set (`i18n.ts` + the shared proposals), we subset to just the glyphs in use (~470) so each
CN weight is ~100 KB. The Nerd-Font (NF) icon glyphs are intentionally dropped — the app draws every
icon with `lucide-react`, so they would be dead weight.

## Regenerating the CN subset

Needed if the Chinese copy gains new characters (otherwise new glyphs fall back to a system CJK face).
Requires `fonttools` + `brotli` (`pip install fonttools brotli`):

```bash
# 1. collect every glyph the app ships (CJK + latin + punctuation)
python3 - <<'PY'
import glob
files = glob.glob('app/src/**/*.ts', recursive=True) + glob.glob('app/src/**/*.tsx', recursive=True) + ['packages/shared/src/voteboard.ts']
chars = set()
for f in files:
    chars |= set(open(f, encoding='utf-8').read())
keep = chars | set(chr(c) for c in range(0x20, 0x7f)) | set('—…“”·、，。：；！？（）《》【】%∞✓↗')
open('/tmp/charset.txt', 'w', encoding='utf-8').write(''.join(sorted(keep)))
PY

# 2. download MapleMono-CN.zip from the v7.9 release, unzip the upright weights, then for each:
pyftsubset MapleMono-CN-Regular.ttf --text-file=/tmp/charset.txt --flavor=woff2 --no-hinting \
  --layout-features='kern,vert,vrt2,ccmp,locl' \
  --output-file=app/src/app/fonts/maple/MapleMonoCN-Regular.woff2
# (repeat for -Bold)
```
