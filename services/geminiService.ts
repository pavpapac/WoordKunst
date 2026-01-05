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


// --- Main Service Functions ---

export interface TranslationPair {
    original: string;
    translated: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
}

export interface CreativeContent {
    translations: TranslationPair[];
    story: string;
    imageUrl: string;
    audioUrl: string;
    comprehensionQuestions?: QuizQuestion[];
}

/**
 * Mode 1: Words -> Story, Comic, Podcast, Vocabulary Quiz
 */
export const generateCreativeContent = async (
    inputWords: string,
    inputLanguage: string,
    translationLanguage: string,
    isBeginner: boolean,
): Promise<CreativeContent> => {
    const originalWords = inputWords
        .split(/[,\s]+/)
        .map(word => word.trim())
        .filter(word => word.length > 0);

    if (originalWords.length === 0) {
        throw new Error("No valid words detected.");
    }
    
    // 1. Translate Words
    const translateResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Translate these words individually from ${inputLanguage} to ${translationLanguage}: ${originalWords.join(', ')}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });
    const translatedWords = JSON.parse(translateResponse.text);
    const translations = originalWords.map((original, index) => ({
        original,
        translated: translatedWords[index] || "Translation not found"
    }));

    // 2. Generate Story
    const storyLanguage = "Dutch";
    const wordsForStory = inputLanguage === 'Dutch' ? originalWords : translatedWords;
    const storyPrompt = isBeginner
        ? `Write a simple, 1-paragraph story in ${storyLanguage} for a beginner. Use these words: ${wordsForStory.join(', ')}.`
        : `Write a fun, short story in ${storyLanguage}. Include these words: ${wordsForStory.join(', ')}.`;

    const storyResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: storyPrompt,
    });
    const story = storyResponse.text;

    // 3. Generate Image
    const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `A vibrant, clear digital illustration of this story: "${story}"` }] },
        config: { imageConfig: { aspectRatio: "16:9" } },
    });
    let imageUrl = "";
    for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
        }
    }

    // 4. Generate Audio
    const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: isBeginner ? `Read clearly and slowly: ${story}` : story }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
    });
    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const audioUrl = base64Audio ? URL.createObjectURL(createWavBlob(decode(base64Audio))) : "";

    return { translations, story, imageUrl, audioUrl };
};

/**
 * Mode 2: Full Story -> Glossary, Comic, Podcast, Comprehension Quiz
 */
export const generateStoryAnalysis = async (
    userStory: string,
    isBeginner: boolean
): Promise<CreativeContent> => {
    // 1. Generate Glossary & Comprehension Quiz
    const analysisResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this Dutch story: "${userStory}". 
        1. Extract 6 difficult or important Dutch words/phrases and translate them to English.
        2. Create 4 multiple-choice comprehension questions in English about the story's content.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    glossary: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                original: { type: Type.STRING, description: "The Dutch word" },
                                translated: { type: Type.STRING, description: "The English translation" }
                            },
                            required: ["original", "translated"]
                        }
                    },
                    questions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswer: { type: Type.STRING }
                            },
                            required: ["question", "options", "correctAnswer"]
                        }
                    }
                },
                required: ["glossary", "questions"]
            }
        }
    });

    const analysis = JSON.parse(analysisResponse.text);

    // 2. Generate Image
    const imageResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `A clear, descriptive storytelling illustration for this text: "${userStory}"` }] },
        config: { imageConfig: { aspectRatio: "16:9" } },
    });
    let imageUrl = "";
    for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
        }
    }

    // 3. Generate Audio
    const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: isBeginner ? `Read slowly: ${userStory}` : userStory }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
        },
    });
    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const audioUrl = base64Audio ? URL.createObjectURL(createWavBlob(decode(base64Audio))) : "";

    return {
        translations: analysis.glossary,
        story: userStory,
        imageUrl,
        audioUrl,
        comprehensionQuestions: analysis.questions
    };
};