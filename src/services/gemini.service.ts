import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';

export interface LocationInfo {
  ianaTimezone: string;
  fullName: string;
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  funFact: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env['API_KEY'] || '' });
  }

  async resolveLocation(query: string): Promise<LocationInfo | null> {
    if (!query || query.trim().length < 2) return null;

    try {
      const model = 'gemini-2.5-flash';
      const prompt = `Identify the most likely IANA timezone identifier (e.g., 'America/New_York', 'Europe/Paris', 'Asia/Tokyo') for the location query: "${query}". 
      Also provide the official full name of the location (City, Country format), just the city name, just the country name, the 2-letter ISO 3166-1 country code (lowercase), and a very short, 1-sentence interesting fun fact about time or culture in this place.
      If the location is invalid or cannot be determined, return null.`;

      const response = await this.ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ianaTimezone: { type: Type.STRING, description: "The IANA timezone ID" },
              fullName: { type: Type.STRING, description: "Full formatted address like 'Paris, France'" },
              city: { type: Type.STRING, description: "City name" },
              country: { type: Type.STRING, description: "Country name" },
              countryCode: { type: Type.STRING, description: "ISO 3166-1 alpha-2 country code (lowercase)" },
              funFact: { type: Type.STRING, description: "A short fun fact" },
              valid: { type: Type.BOOLEAN, description: "True if location was found" }
            },
            required: ["ianaTimezone", "fullName", "city", "country", "countryCode", "funFact", "valid"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      
      if (!data.valid) return null;

      return {
        ianaTimezone: data.ianaTimezone,
        fullName: data.fullName,
        city: data.city,
        country: data.country,
        countryCode: data.countryCode,
        funFact: data.funFact
      };

    } catch (e) {
      console.error('Gemini API Error:', e);
      return null;
    }
  }
}