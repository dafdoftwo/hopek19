const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const mediaDir = path.join(__dirname, 'media');
const outputDir = path.join(__dirname, 'media', 'optimized');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const images = [
    '495378672_122163648458382936_5354201003752853940_n.jpg',
    '51Ft+jIPKaL._AC_.jpg',
    '51hM6sS8Z9L._AC_SL1200_.jpg',
    'antina-signal.png',
    'charging-other-mobile.png',
    "close-up shot of a Civil Engineer's hand holding.png",
    'displaying 4 different SIM card.png',
    'flashlight.png',
    'hope-k19-in-desert.png',
    'official.png',
    'waterproof.png',
    'Hbaeb7cb3fe234d9894ee1a8628da471an.jpg'
];

async function optimizeImages() {
    console.log('Starting image optimization...');

    for (const image of images) {
        const inputPath = path.join(mediaDir, image);
        if (!fs.existsSync(inputPath)) {
            console.log(`Skipping ${image}: File not found`);
            continue;
        }

        const parsedPath = path.parse(image);
        // Create a safe filename for the web
        const safeName = parsedPath.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        const outputPath = path.join(outputDir, `${safeName}.webp`);

        try {
            await sharp(inputPath)
                .resize(1200, null, { // Resize width to 1200px, maintain aspect ratio
                    withoutEnlargement: true // Do not scale up if smaller
                })
                .webp({ quality: 80 }) // Convert to WebP with 80% quality
                .toFile(outputPath);

            const inputStats = fs.statSync(inputPath);
            const outputStats = fs.statSync(outputPath);
            const saving = ((inputStats.size - outputStats.size) / inputStats.size * 100).toFixed(2);

            console.log(`Optimized ${image} -> ${safeName}.webp`);
            console.log(`Size: ${(inputStats.size / 1024 / 1024).toFixed(2)}MB -> ${(outputStats.size / 1024 / 1024).toFixed(2)}MB (${saving}% saved)`);
        } catch (error) {
            console.error(`Error optimizing ${image}:`, error);
        }
    }
    
    console.log('Optimization complete!');
}

optimizeImages();
