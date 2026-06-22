# NeonWave Radio static website

This is a backend-free web radio website designed for GitHub Pages or any static host.

## Customize

Edit `config.js`:

- `stationName`, `shortName`, and `tagline`
- `streamUrl` with your Icecast, Shoutcast, AzuraCast, Radio.co, Live365, or other HTTPS stream URL
- `shows`, `schedule`, and social links

The page uses the direct stream URL extracted from the Radio12345 page, without embedding the full provider page.

## Deploy on GitHub Pages

1. Upload these files to a GitHub repository.
2. Open repository Settings.
3. Go to Pages.
4. Select the branch and folder containing `index.html`.
5. Save, then open the published Pages URL.

For best browser compatibility, use an HTTPS stream URL. Some radio hosts need CORS enabled if you want deeper audio analysis, but playback itself usually works with a direct stream URL.
