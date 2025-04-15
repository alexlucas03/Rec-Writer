import { queryService } from './queryService';
import { dbStorage } from '../utils/indexedDBStorage';

export interface AnalysisCategories {
  introduction_context: string[];
  endorsement: string[];
  commentary: string[];
  qualities: string[];
  further_discussion: string[];
}

class WritingSampleAnalyzer {
  private readonly DEFAULT_MODEL = 'gemma3';
  
  /**
   * Analyzes a writing sample and categorizes sentences
   * @param sample The writing sample to analyze
   * @param teacherName The name of the teacher
   * @returns Promise containing the categorization result
   */
  async analyzeSample(sample: string, teacherName: string): Promise<AnalysisCategories> {
    try {
      // Create the analysis prompt
      const prompt = `
Split the sentences from the following passage into these categories: 
- introduction/context (sentences that introduce the student or provide background)
- endorsement (sentences that directly support/endorse the student)
- commentary (sentences that offer opinions or observations)
- qualities (sentences that highlight specific skills or attributes)
- requests for further discussion (sentences inviting follow-up or providing contact information)

Format your response as a JSON object with these exact keys: introduction_context, endorsement, commentary, qualities, further_discussion. 
Each key should have an array of strings, with each string being a complete sentence from the passage.
Every sentence from the passage must be included in exactly one category.

PASSAGE:
${sample}
`;

      // Generate the analysis using the LLM
      const response = await queryService.generateText({
        model: this.DEFAULT_MODEL,
        prompt: prompt,
        options: {
          temperature: 0.3, // Lower temperature for more deterministic categorization
          top_p: 0.9,
          max_tokens: 2000,
        },
      });
      
      // Parse the response (expecting JSON)
      try {
        const analysisResult = this.parseAnalysisResponse(response.text);
        
        // Store the categorized content in localStorage and log to console
        // Instead of overwriting, we'll append to existing categories
        this.storeAndAppendCategories(analysisResult, teacherName, sample);
        
        // Save the analysis result to IndexedDB for future reference
        await this.saveAnalysisToDatabase(analysisResult, sample, teacherName);
        
        return analysisResult;
      } catch (parseError) {
        console.error('Failed to parse LLM response:', parseError);
        throw new Error('Failed to parse categorization result');
      }
    } catch (error) {
      console.error('Failed to analyze writing sample:', error);
      throw error;
    }
  }
  
  /**
   * Parses the LLM response to extract categorized sentences
   */
  private parseAnalysisResponse(responseText: string): AnalysisCategories {
    // Try to extract JSON from the response text
    let jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const parsedData = JSON.parse(jsonMatch[0]);
        
        // Ensure the parsed data has all required categories
        const result: AnalysisCategories = {
          introduction_context: Array.isArray(parsedData.introduction_context) ? parsedData.introduction_context : [],
          endorsement: Array.isArray(parsedData.endorsement) ? parsedData.endorsement : [],
          commentary: Array.isArray(parsedData.commentary) ? parsedData.commentary : [],
          qualities: Array.isArray(parsedData.qualities) ? parsedData.qualities : [],
          further_discussion: Array.isArray(parsedData.further_discussion) ? parsedData.further_discussion : []
        };
        
        return result;
      } catch (e) {
        console.error('JSON parsing error:', e);
      }
    }
    
    // Fallback: try to extract categories manually if JSON parsing failed
    const defaultResult: AnalysisCategories = {
      introduction_context: [],
      endorsement: [],
      commentary: [],
      qualities: [],
      further_discussion: []
    };
    
    const categoryHeaders = [
      'introduction/context',
      'endorsement',
      'commentary',
      'qualities', 
      'requests for further discussion'
    ];
    
    let currentCategory: keyof AnalysisCategories | null = null;
    
    for (const line of responseText.split('\n')) {
      const trimmedLine = line.trim();
      
      // Check if this line is a category header
      if (categoryHeaders.some(header => trimmedLine.toLowerCase().includes(header.toLowerCase()))) {
        if (trimmedLine.toLowerCase().includes('introduction')) {
          currentCategory = 'introduction_context';
        } else if (trimmedLine.toLowerCase().includes('endorsement')) {
          currentCategory = 'endorsement';
        } else if (trimmedLine.toLowerCase().includes('commentary')) {
          currentCategory = 'commentary';
        } else if (trimmedLine.toLowerCase().includes('qualities')) {
          currentCategory = 'qualities';
        } else if (trimmedLine.toLowerCase().includes('further') || 
                  trimmedLine.toLowerCase().includes('discussion')) {
          currentCategory = 'further_discussion';
        }
      } 
      // If we have a current category and the line has content (not just a header)
      else if (currentCategory && trimmedLine.length > 0 && 
              !trimmedLine.startsWith('-') && !trimmedLine.startsWith('#')) {
        // Clean up the line (remove bullet points, etc.)
        let cleanedLine = trimmedLine.replace(/^[•\-*]\s*/, '').trim();
        
        // Add the sentence to the current category if it's not empty
        if (cleanedLine.length > 0) {
          defaultResult[currentCategory].push(cleanedLine);
        }
      }
    }
    
    return defaultResult;
  }
  
  /**
   * Gets the current storage key for the categories
   */
  private getCategoryStorageKey(teacherName: string): string {
    return `categorized_sentences_${teacherName.replace(/\s+/g, '_')}`;
  }
  
  /**
   * Stores the categorized content by appending to existing categories
   */
  private storeAndAppendCategories(
    newCategories: AnalysisCategories, 
    teacherName: string,
    sampleContent: string
  ): void {
    try {
      const storageKey = this.getCategoryStorageKey(teacherName);
      
      // Get existing categories from localStorage
      let existingCategoriesJson = localStorage.getItem(storageKey);
      let existingCategories: AnalysisCategories = {
        introduction_context: [],
        endorsement: [],
        commentary: [],
        qualities: [],
        further_discussion: []
      };
      
      if (existingCategoriesJson) {
        try {
          existingCategories = JSON.parse(existingCategoriesJson);
        } catch (e) {
          console.error('Failed to parse existing categories:', e);
          // Continue with empty categories
        }
      }
      
      // Create a map to check for duplicates
      const existingSentences = new Set<string>();
      
      // Add all existing sentences to the set for duplicate checking
      Object.values(existingCategories).forEach(sentences => {
        sentences.forEach((sentence: string) => existingSentences.add(sentence.trim()));
      });
      
      // Append new categories to existing ones, avoiding duplicates
      const mergedCategories: AnalysisCategories = {
        introduction_context: [...existingCategories.introduction_context],
        endorsement: [...existingCategories.endorsement],
        commentary: [...existingCategories.commentary],
        qualities: [...existingCategories.qualities],
        further_discussion: [...existingCategories.further_discussion]
      };
      
      // Append new sentences, avoiding duplicates
      Object.entries(newCategories).forEach(([category, sentences]) => {
        const categoryKey = category as keyof AnalysisCategories;
        sentences.forEach((sentence: string) => {
          const trimmed = sentence.trim();
          if (!existingSentences.has(trimmed)) {
            mergedCategories[categoryKey].push(trimmed);
            existingSentences.add(trimmed);
          }
        });
      });
      
      // Save merged categories back to localStorage
      localStorage.setItem(storageKey, JSON.stringify(mergedCategories));
      
      // Save the original sample content
      const sampleTimestamp = Date.now();
      const sampleKey = `sample_${teacherName.replace(/\s+/g, '_')}_${sampleTimestamp}`;
      localStorage.setItem(sampleKey, sampleContent);
      
      // Log the new sentences added in each category
      console.log('New sentences added to categories:');
      console.group('Analysis Results');
      Object.entries(newCategories).forEach(([category, sentences]) => {
        console.log(`${category}: ${sentences.length} sentences`);
        if (sentences.length > 0) {
          console.group(category);
          sentences.forEach((sentence: string, i: number) => console.log(`${i + 1}. ${sentence}`));
          console.groupEnd();
        }
      });
      console.groupEnd();
      
      // Display a summary of all categories
      console.log('Updated category totals:');
      console.table({
        'Introduction/Context': mergedCategories.introduction_context.length,
        'Endorsement': mergedCategories.endorsement.length,
        'Commentary': mergedCategories.commentary.length,
        'Qualities': mergedCategories.qualities.length,
        'Further Discussion': mergedCategories.further_discussion.length,
        'Total Sentences': 
          mergedCategories.introduction_context.length + 
          mergedCategories.endorsement.length + 
          mergedCategories.commentary.length + 
          mergedCategories.qualities.length + 
          mergedCategories.further_discussion.length
      });
      
    } catch (error) {
      console.error('Failed to store categorized content:', error);
    }
  }
  
  /**
   * Retrieves all categorized sentences for a teacher
   */
  getCategories(teacherName: string): AnalysisCategories {
    const storageKey = this.getCategoryStorageKey(teacherName);
    const categoriesJson = localStorage.getItem(storageKey);
    
    if (categoriesJson) {
      try {
        return JSON.parse(categoriesJson);
      } catch (e) {
        console.error('Failed to parse categories:', e);
      }
    }
    
    // Return empty categories if none found
    return {
      introduction_context: [],
      endorsement: [],
      commentary: [],
      qualities: [],
      further_discussion: []
    };
  }
  
  /**
   * Clears all categorized sentences for a teacher
   */
  clearCategories(teacherName: string): void {
    const storageKey = this.getCategoryStorageKey(teacherName);
    localStorage.removeItem(storageKey);
    
    // Also remove any sample data for this teacher
    const sampleKeyPrefix = `sample_${teacherName.replace(/\s+/g, '_')}`;
    
    // Find and remove all related sample keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(sampleKeyPrefix)) {
        localStorage.removeItem(key);
      }
    }
    
    console.log(`Cleared all categorized sentences for ${teacherName}`);
  }
  
  /**
   * Exports the categorized sentences to text files
   */
  exportCategories(teacherName: string): void {
    const categories = this.getCategories(teacherName);
    
    // Create a file for each category
    Object.entries(categories).forEach(([category, sentences]) => {
      if (sentences.length === 0) return;
      
      const content = sentences.join('\n');
      const fileName = `${category}.txt`;
      
      // Create a download link
      const element = document.createElement('a');
      const file = new Blob([content], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = fileName;
      
      // Add to document, click, and remove
      document.body.appendChild(element);
      element.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);
      }, 100);
    });
  }
  
  /**
   * Saves the analysis result to IndexedDB
   */
  private async saveAnalysisToDatabase(
    analysis: AnalysisCategories,
    originalSample: string,
    teacherName: string
  ): Promise<void> {
    try {
      const analysisId = `analysis-${Date.now()}`;
      
      await dbStorage.saveUserInput({
        id: analysisId,
        timestamp: Date.now(),
        content: JSON.stringify(analysis),
        type: 'sample-analysis',
        teacherName: teacherName,
        metadata: {
          originalSample,
          originalSampleId: `sample-${Date.now()}`, // This will be updated later with the correct ID
          categoryCounts: {
            introduction_context: analysis.introduction_context.length,
            endorsement: analysis.endorsement.length,
            commentary: analysis.commentary.length,
            qualities: analysis.qualities.length,
            further_discussion: analysis.further_discussion.length
          }
        }
      });
    } catch (dbError) {
      console.error('Failed to save analysis to database:', dbError);
    }
  }
}

export const writingSampleAnalyzer = new WritingSampleAnalyzer();