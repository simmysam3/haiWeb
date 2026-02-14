# HAIWAVE Website Template

## Structure

```
haiwave-site/
  index.html              Main page
  css/
    styles.css            All styles (tokens, components, layout, responsive)
  js/
    main.js               Nav scroll behavior, intersection observer reveals
  img/
    wave-watermark.svg    Background wave watermark (75vh, fixed position)
    hero-orbital.svg      Animated constellation diagram (hero section)
    network-layers.svg    Static network layer diagram (network section)
```

## Brand Tokens (CSS Custom Properties)

All brand colors, spacing, and typography are defined as CSS variables in `:root`.
Modify `css/styles.css` lines 1-70 to update brand values globally.

### Primary Palette
- `--navy: #1A1F36` (headlines, primary backgrounds)
- `--orange: #F58220` (AI emphasis, warm accents)
- `--teal: #29B0C3` (Wave component, connections, cool accents)

### Layer Colors (network diagrams)
- `--layer-0: #0055A8` (Anchor/Cobalt)
- `--layer-1: #29B0C3` (Trading Partners/Teal)
- `--layer-2: #F25D00` (Suppliers/Orange)
- `--lateral: #CBD5E1` (Discovery/Dashed Gray)

### Typography
- Display: Space Grotesk (headlines, metrics, pricing)
- Body: DM Sans (paragraphs, labels, nav)

## Logo Treatment

The hAIWave logo is rendered with CSS classes:
- `.logo-h` lowercase navy h
- `.logo-ai` orange AI
- `.logo-wave` teal Wave

## Serving Locally

Any static file server works:

```bash
# Python
cd haiwave-site && python3 -m http.server 8000

# Node
npx serve haiwave-site

# PHP
cd haiwave-site && php -S localhost:8000
```

Open `http://localhost:8000` in your browser.

## Wave Watermark

The wave watermark (`img/wave-watermark.svg`) is a fixed-position background element
covering 75% of viewport height. It uses a CSS radial gradient mask to concentrate
visibility in the lower-right quadrant. Wave opacity values can be adjusted by editing
the `rgba()` fill values in the SVG file.

## Customization

- **Content**: Edit `index.html` directly. All section content is plain HTML.
- **Colors/Spacing**: Modify CSS variables in the `:root` block of `css/styles.css`.
- **Wave intensity**: Edit opacity values in `img/wave-watermark.svg`.
- **Animations**: Orbit speeds and reveal timings are in `css/styles.css` animation section.
- **Responsive breakpoints**: 1024px (tablet) and 768px (mobile) in `css/styles.css`.
