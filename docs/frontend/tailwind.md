# Tailwind CSS Setup

For production, Tailwind CSS needs to be compiled instead of using the CDN.

## Quick Build

Run the Python build script (works on Linux/Mac):

```bash
python build_css.py
```

Or use the shell script:

```bash
chmod +x build_css.sh
./build_css.sh
```

This will:
1. Download Tailwind CLI standalone binary (if not present)
2. Compile `app/static/src/input.css` → `app/static/css/output.css`
3. Minify the output for production

## Development

In development mode (`APP_ENV=development`), the templates use the Tailwind CDN for convenience.

## Production

Set `APP_ENV=production` in your `.env` file and ensure `app/static/css/output.css` exists (run build script before deploying).
