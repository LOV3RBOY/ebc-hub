/**
 * Gemini AI Service for EBC Hub
 * Uses Gemini 3 Pro to analyze images and generate contextual captions
 */

const GEMINI_API_KEY = 'AIzaSyA_gnh_KHkzoS5lOYn7c7GF_zcsFDMVTOs';
const GEMINI_MODEL = 'gemini-2.0-flash'; // Latest vision-capable model
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Convert image URL to base64 data
 */
async function imageUrlToBase64(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data URL prefix to get pure base64
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Generate AI-powered captions for an image
 * @param {string} imageSource - URL or base64 data of the image
 * @param {string} style - Optional style hint (e.g., "fun", "professional", "energetic")
 * @returns {Promise<Array<{text: string, hashtags: string}>>} Array of caption objects
 */
async function generateAICaptions(imageSource, style = 'energetic') {
    try {
        // Convert to base64 if it's a URL
        let base64Data;
        if (imageSource.startsWith('data:')) {
            // Already base64 data URL
            base64Data = imageSource.split(',')[1];
        } else if (imageSource.startsWith('http')) {
            // URL - need to fetch and convert
            base64Data = await imageUrlToBase64(imageSource);
        } else {
            // Assume it's already base64
            base64Data = imageSource;
        }

        const prompt = `You are a social media expert for Encore Beach Collective (EBC), a Las Vegas pool party and events company.

Analyze this image and generate 3 creative, engaging Instagram captions.

Style: ${style}

Guidelines:
- Fun, energetic, Vegas pool party vibes
- Use relevant emojis (🌴☀️💦🔥🎉✨🌅🏝️💃🕺🍾)
- Keep captions 1-3 sentences max
- Match the mood of the photo (daytime fun, sunset vibes, party energy, team moments, etc.)
- Be creative and authentic - avoid generic phrases
- Include subtle call-to-action when appropriate

For each caption, also suggest 5-7 relevant hashtags that would perform well on Instagram.

IMPORTANT: Return ONLY valid JSON in this exact format, no other text:
{
  "captions": [
    {"text": "Caption 1 here with emojis ☀️", "hashtags": "#vegas #poolparty #vibes #summer #ebc"},
    {"text": "Caption 2 here with emojis 🔥", "hashtags": "#lasvegas #poolside #partytime #summervibes #encore"},
    {"text": "Caption 3 here with emojis 🌴", "hashtags": "#vegaslife #poolclub #sunshine #goodtimes #ebcvibes"}
  ]
}`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64Data
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.9,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Error:', errorData);
            throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();

        // Extract the text response
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!textResponse) {
            throw new Error('No response from Gemini');
        }

        // Parse JSON from response (handle potential markdown code blocks)
        let jsonStr = textResponse;
        if (textResponse.includes('```json')) {
            jsonStr = textResponse.split('```json')[1].split('```')[0].trim();
        } else if (textResponse.includes('```')) {
            jsonStr = textResponse.split('```')[1].split('```')[0].trim();
        }

        const parsed = JSON.parse(jsonStr);

        console.log('🤖 AI Captions generated:', parsed.captions);
        return parsed.captions;

    } catch (error) {
        console.error('Error generating AI captions:', error);
        throw error;
    }
}

/**
 * Generate a quick single caption (for simpler use cases)
 */
async function generateQuickCaption(imageSource) {
    const captions = await generateAICaptions(imageSource, 'fun and engaging');
    return captions[0];
}

// Export for use in app.js
export { generateAICaptions, generateQuickCaption };
