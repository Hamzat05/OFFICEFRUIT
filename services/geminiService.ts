
import { GoogleGenAI, Type } from "@google/genai";
import { FRUITS } from '../constants';

export const getFruitRecommendation = async (teamSize: number, mood: string) => {
  // Use API key directly from process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Act as a 'Fruit Guru' for a corporate office. 
  The team size is ${teamSize} people. 
  The office mood is currently: "${mood}".
  Suggest a mix of fruits from the following available list: ${FRUITS.map(f => f.name).join(', ')}.
  Provide a JSON response containing an array of objects with 'fruitName' and 'quantity'. 
  Also include a short, catchy, fruity 'guruMessage' describing why this mix is perfect.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            guruMessage: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fruitName: { type: Type.STRING },
                  quantity: { type: Type.NUMBER }
                },
                required: ["fruitName", "quantity"]
              }
            }
          },
          required: ["guruMessage", "recommendations"]
        }
      }
    });

    // Access .text property directly and trim as per guidelines
    const jsonStr = response.text?.trim() || '{}';
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};
