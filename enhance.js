/**
 * EBC Hub - Image Enhancement Module
 * Client-side photo enhancement using HTML5 Canvas
 * 
 * Features:
 * - Auto-levels (brightness/contrast normalization)
 * - Vibrance boost (saturates colors while protecting skin tones)
 * - Warmth adjustment (beach club color temperature)
 * - Sharpening (unsharp mask)
 * - Preset filters
 */

// ===========================
// Enhancement Engine
// ===========================

const ImageEnhancer = {

    /**
     * Main enhancement function - applies all auto-corrections
     * @param {string} imageDataUrl - Base64 image data URL
     * @param {Object} options - Enhancement options
     * @returns {Promise<string>} - Enhanced image data URL
     */
    async enhance(imageDataUrl, options = {}) {
        const defaults = {
            brightness: 1.05,      // Slight brightness boost
            contrast: 1.15,        // Moderate contrast increase
            vibrance: 25,          // Color pop without oversaturation
            warmth: 10,            // Warm beach vibe
            sharpen: 0.3,          // Subtle sharpening
            autoLevels: true       // Auto histogram stretch
        };

        const settings = { ...defaults, ...options };

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    canvas.width = img.width;
                    canvas.height = img.height;

                    // Draw original image
                    ctx.drawImage(img, 0, 0);

                    // Get image data for pixel manipulation
                    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    // Apply enhancements in order
                    if (settings.autoLevels) {
                        imageData = this.applyAutoLevels(imageData);
                    }

                    imageData = this.applyBrightnessContrast(imageData, settings.brightness, settings.contrast);
                    imageData = this.applyVibrance(imageData, settings.vibrance);
                    imageData = this.applyWarmth(imageData, settings.warmth);

                    // Put processed data back
                    ctx.putImageData(imageData, 0, 0);

                    // Apply sharpening as convolution (needs separate pass)
                    if (settings.sharpen > 0) {
                        this.applySharpen(ctx, canvas, settings.sharpen);
                    }

                    // Return as data URL
                    resolve(canvas.toDataURL('image/jpeg', 0.92));
                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = () => reject(new Error('Failed to load image for enhancement'));
            img.src = imageDataUrl;
        });
    },

    /**
     * Auto-levels: Stretches histogram to use full dynamic range
     */
    applyAutoLevels(imageData) {
        const data = imageData.data;
        let minR = 255, maxR = 0;
        let minG = 255, maxG = 0;
        let minB = 255, maxB = 0;

        // Find min/max values for each channel
        for (let i = 0; i < data.length; i += 4) {
            minR = Math.min(minR, data[i]);
            maxR = Math.max(maxR, data[i]);
            minG = Math.min(minG, data[i + 1]);
            maxG = Math.max(maxG, data[i + 1]);
            minB = Math.min(minB, data[i + 2]);
            maxB = Math.max(maxB, data[i + 2]);
        }

        // Stretch values to 0-255 range
        const rangeR = maxR - minR || 1;
        const rangeG = maxG - minG || 1;
        const rangeB = maxB - minB || 1;

        for (let i = 0; i < data.length; i += 4) {
            data[i] = ((data[i] - minR) / rangeR) * 255;
            data[i + 1] = ((data[i + 1] - minG) / rangeG) * 255;
            data[i + 2] = ((data[i + 2] - minB) / rangeB) * 255;
        }

        return imageData;
    },

    /**
     * Brightness and Contrast adjustment
     */
    applyBrightnessContrast(imageData, brightness, contrast) {
        const data = imageData.data;
        const factor = (259 * (contrast * 255 - 128)) / (255 * (259 - (contrast * 255 - 128)));

        for (let i = 0; i < data.length; i += 4) {
            // Apply brightness
            data[i] = data[i] * brightness;
            data[i + 1] = data[i + 1] * brightness;
            data[i + 2] = data[i + 2] * brightness;

            // Apply contrast
            data[i] = this.clamp(factor * (data[i] - 128) + 128);
            data[i + 1] = this.clamp(factor * (data[i + 1] - 128) + 128);
            data[i + 2] = this.clamp(factor * (data[i + 2] - 128) + 128);
        }

        return imageData;
    },

    /**
     * Vibrance: Boosts saturation of less-saturated colors
     * Preserves skin tones while making backgrounds pop
     */
    applyVibrance(imageData, amount) {
        const data = imageData.data;
        const amt = amount / 100;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = (max - min) / 255;

            // Less boost for already-saturated colors (protects skin tones)
            const boost = amt * (1 - saturation);

            const avg = (r + g + b) / 3;

            data[i] = this.clamp(r + (r - avg) * boost);
            data[i + 1] = this.clamp(g + (g - avg) * boost);
            data[i + 2] = this.clamp(b + (b - avg) * boost);
        }

        return imageData;
    },

    /**
     * Warmth: Shifts color temperature (positive = warmer/orange, negative = cooler/blue)
     */
    applyWarmth(imageData, amount) {
        const data = imageData.data;
        const warmth = amount / 100 * 30; // Scale to reasonable range

        for (let i = 0; i < data.length; i += 4) {
            data[i] = this.clamp(data[i] + warmth);      // Boost red
            data[i + 2] = this.clamp(data[i + 2] - warmth); // Reduce blue
        }

        return imageData;
    },

    /**
     * Sharpening using unsharp mask technique
     */
    applySharpen(ctx, canvas, amount) {
        const weights = [
            0, -amount, 0,
            -amount, 1 + 4 * amount, -amount,
            0, -amount, 0
        ];

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        const output = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            sum += data[idx] * weights[(ky + 1) * 3 + (kx + 1)];
                        }
                    }
                    output[(y * width + x) * 4 + c] = this.clamp(sum);
                }
            }
        }

        const outputImageData = new ImageData(output, width, height);
        ctx.putImageData(outputImageData, 0, 0);
    },

    /**
     * Clamp value to 0-255 range
     */
    clamp(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    },

    // ===========================
    // Preset Filters
    // ===========================

    presets: {
        'encore-vibes': {
            name: 'Encore Vibes',
            brightness: 1.08,
            contrast: 1.18,
            vibrance: 30,
            warmth: 15,
            sharpen: 0.25,
            autoLevels: true
        },
        'pool-day': {
            name: 'Pool Day',
            brightness: 1.1,
            contrast: 1.12,
            vibrance: 35,
            warmth: -5,  // Slightly cooler for blue emphasis
            sharpen: 0.2,
            autoLevels: true
        },
        'golden-hour': {
            name: 'Golden Hour',
            brightness: 1.05,
            contrast: 1.1,
            vibrance: 20,
            warmth: 25,
            sharpen: 0.15,
            autoLevels: true
        },
        'clean-pro': {
            name: 'Clean Pro',
            brightness: 1.02,
            contrast: 1.2,
            vibrance: 10,
            warmth: 0,
            sharpen: 0.35,
            autoLevels: true
        }
    },

    /**
     * Apply a preset filter by name
     */
    async applyPreset(imageDataUrl, presetName) {
        const preset = this.presets[presetName];
        if (!preset) {
            throw new Error(`Unknown preset: ${presetName}`);
        }
        return this.enhance(imageDataUrl, preset);
    },

    /**
     * Get list of available presets
     */
    getPresets() {
        return Object.entries(this.presets).map(([key, value]) => ({
            id: key,
            name: value.name
        }));
    }
};

// Make available globally
window.ImageEnhancer = ImageEnhancer;
