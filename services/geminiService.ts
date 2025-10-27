import { GoogleGenAI, Type, Modality } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Audio Helper Functions ---

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function createWavBlob(pcmData: Uint8Array): Blob {
    const sampleRate = 24000;
    const numChannels = 1;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);
    writeString(view, 8, 'WAVE');
    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true); // bits per sample
    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    return new Blob([view, pcmData], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}


// --- Main Service Function ---

export interface CreativeContent {
    translations: { original: string; translated: string; }[];
    story: string;
    imageUrl: string;
    audioUrl: string;
}

export const generateCreativeContent = async (
    inputWords: string,
    inputLanguage: string,
    translationLanguage: string,
    isBeginner: boolean,
): Promise<CreativeContent> => {
    const originalWords = inputWords.split(',').map(word => word.trim());
    
    // 1. Translate Words
    let translatedWords: string[];
    try {
        const translateResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Translate these words from ${inputLanguage} to ${translationLanguage}: ${inputWords}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        description: "A single translated word."
                    }
                }
            }
        });
        translatedWords = JSON.parse(translateResponse.text);
        if (!translatedWords || translatedWords.length === 0) {
            throw new Error("Translation returned no words.");
        }
    } catch (error) {
        console.error("Error during translation:", error);
        throw new Error("Step 1/4: Failed to translate the words. The model may have had trouble understanding the input.");
    }
    
    const translations = originalWords.map((original, index) => ({
        original: original,
        translated: translatedWords[index] || "Translation not found"
    }));

    // Determine words to use for the story. Story is always in Dutch.
    const storyLanguage = "Dutch";
    let wordsForStory: string[];

    if (inputLanguage === 'Dutch') {
        // If input is Dutch, use the original words for the Dutch story.
        wordsForStory = originalWords;
    } else {
        // If input is English, use the translated (Dutch) words for the Dutch story.
        wordsForStory = translatedWords;
    }


    // 2. Generate Story
    let story: string;
    try {
        const storyPrompt = isBeginner
            ? `Write a simple story in ${storyLanguage} for a beginner language learner. The story should be about one paragraph long and easy to understand. It must include the following words: ${wordsForStory.join(', ')}.`
            : `Write a short, fun, simple story in ${storyLanguage} for a language learner. The story must include the following words: ${wordsForStory.join(', ')}.`;

        const storyResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: storyPrompt,
        });
        story = storyResponse.text;
        if (!story) {
            throw new Error("Story generation returned empty content.");
        }
    } catch (error) {
        console.error("Error during story generation:", error);
        throw new Error(`Step 2/4: Failed to generate a story with the translated words. Please try a different set of words.`);
    }

    // 3. Generate Image
    let imageUrl: string;
    try {
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `A fun, vibrant, simple comic book panel illustrating this short story: "${story}"`,
            config: {
                numberOfImages: 1,
                aspectRatio: '16:9',
                outputMimeType: 'image/jpeg',
            },
        });
        const base64Image = imageResponse.generatedImages[0]?.image.imageBytes;
        if (!base64Image) {
            throw new Error("Image generation returned no image data.");
        }
        imageUrl = `data:image/jpeg;base64,${base64Image}`;
    } catch (error) {
        console.error("Error during image generation:", error);
        throw new Error("Step 3/4: Failed to create the comic image from the story.");
    }

    // 4. Generate Podcast (TTS)
    let audioUrl: string;
    try {
        const ttsPrompt = isBeginner
            ? `Read the following text clearly and at a slightly slower pace for a language learner: ${story}`
            : story;

        const ttsResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: ttsPrompt }] }],
            config: {
                responseModalities: [Modality.AUDIO],
            },
        });
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("Podcast generation returned no audio data.");
        }
        
        const pcmData = decode(base64Audio);
        const wavBlob = createWavBlob(pcmData);
        audioUrl = URL.createObjectURL(wavBlob);
    } catch (error) {
        console.error("Error during podcast generation:", error);
        throw new Error("Step 4/4: Failed to generate the podcast audio for the story.");
    }

    return { translations, story, imageUrl, audioUrl };
};