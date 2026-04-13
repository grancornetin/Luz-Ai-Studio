import { GoogleGenAI } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const dummyImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  
  const parts = [
    { text: "REF1:" },
    { inlineData: { mimeType: "image/png", data: dummyImage } },
    { text: "REF2:" },
    { inlineData: { mimeType: "image/png", data: dummyImage } },
    { text: "A photo of a person." }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: "3:4" }
      }
    });
    console.log("Success!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

test();
