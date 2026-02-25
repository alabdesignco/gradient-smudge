# Three.js Gradient Smudge

A mouse-reactive gradient effect built with Three.js. Moving the cursor over a tagged element distorts the gradient image using a canvas-encoded velocity trail fed into a GLSL shader.

## Development

```bash
npm install
npm run dev
```

Add the `data-gradient` attribute to any element in `index.html` to activate the effect. The element must have explicit dimensions (width/height) for the mesh to size correctly.

## Build

```bash
npm run build
```

Outputs a single self-contained `dist/app.js` file. Both `gradient.jpg` and `noise.png` are base64-inlined so no separate asset files are needed.

## Webflow Integration

### 1. Deploy to Vercel

Push the repo to GitHub, connect it to [Vercel](https://vercel.com), and set the **Output Directory** to `dist`. Vercel will run `npm run build` automatically.

Your script will be available at:
```
https://your-project.vercel.app/app.js
```

### 2. Add the script to Webflow

In **Webflow → Site Settings → Custom Code → Footer**, paste:

```html
<script src="https://your-project.vercel.app/app.js"></script>
```

### 3. Tag your elements

In the Webflow Designer, select any element and add a custom attribute:

- **Name:** `data-gradient`
- **Value:** *(leave empty)*

The effect will render on every element tagged with `data-gradient`. Multiple elements on the same page are supported — they share one WebGL renderer.

The element must have a defined size (width + height) in Webflow. The WebGL canvas renders behind all page content (`position: fixed`, `z-index: 0`, `pointer-events: none`), so page layout is unaffected.

## Assets

| File | Purpose |
|---|---|
| `assets/gradient.jpg` | The gradient image sampled by the shader |
| `assets/noise.png` | Grayscale noise texture used to displace the smudge trail |

To swap the gradient, replace `assets/gradient.jpg` and rebuild.
